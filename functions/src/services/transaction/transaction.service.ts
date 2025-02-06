import { injectable, inject } from 'tsyringe';
import { TransactionRepository } from '../../repositories/transaction/transaction.repository';
import mongoose, { Types } from 'mongoose';
import {
  IDescuentoAplicado,
  IDevolucionesCreate,
  IDevolucionesProducto,
  ITransaccion,
  ITransaccionCreate,
  ITransaccionDescuento,
  ITransaccionNoDto,
  ITransaccionResponse,
  ITrasaccionProducto,
  ITrasaccionProductoResponse,
  TypePaymentMethod,
  TypeTransaction,
} from '../../models/transaction/Transaction.model';
import {
  ITipoDescuento,
  ITransaccionDescuentosAplicados,
} from '../../models/transaction/TransactionDescuentosAplicados.model';
import { IDetalleTransaccion } from '../../models/transaction/DetailTransaction.model';
import { IProducto } from '../../models/inventario/Producto.model';
import { IInventarioSucursal } from '../../models/inventario/InventarioSucursal.model';
import { IUser } from '../../models/usuarios/User.model';
import { CustomJwtPayload } from '../../utils/jwt';
import { ISucursal } from '../../models/sucursales/Sucursal.model';
import { InventoryManagementService } from '../traslado/InventoryManagement.service';
import { IAddQuantity, IInit, ISubtractQuantity, TipoMovimientoInventario } from '../../interface/IInventario';
import { IDescuento, ITipoDescuentoEntidad } from '../../models/transaction/Descuento.model';
import { notifyTelergramReorderThreshold } from '../utils/telegramServices';
import { DescuentoRepository } from '../../repositories/transaction/descuento.repository';
import { IDescuentosProductos } from '../../models/transaction/DescuentosProductos.model';
import { CashRegisterService } from '../utils/cashRegister.service';
import { ITransactionCreateCaja, tipoEstatusSales, TypeEstatusTransaction } from '../../interface/ICaja';
import { ICredito, ModalidadCredito, TypeCredito } from '../../models/credito/Credito.model';
import { CreditoService } from '../credito/Credito.service';
import { ResumenCajaDiarioRepository } from '../../repositories/caja/DailyCashSummary.repository';
import { CreditoRepository } from '../../repositories/credito/Credito.repository';
import {
  cero128,
  compareDecimal128,
  compareToCero,
  dividirDecimal128,
  formatObejectId,
  multiplicarDecimal128,
  restarDecimal128,
  sumarDecimal128,
} from '../../gen/handleDecimal128';
import { getDateInManaguaTimezone } from '../../utils/date';
import { IDescuentoGrupo } from '../../models/transaction/DescuentoGrupo.model';
import { ICaja } from '../../models/cashRegister/CashRegister.model';
import { parse } from 'path';
import { IResumenCajaDiario } from '../../models/cashRegister/DailyCashSummary.model';

export interface ICreateTransactionProps {
  venta: Partial<ITransaccionCreate>;
  user: CustomJwtPayload;
}

@injectable()
export class TransactionService {
  constructor(
    @inject(TransactionRepository) private repository: TransactionRepository,
    @inject(InventoryManagementService)
    private inventoryManagementService: InventoryManagementService,
    @inject(DescuentoRepository)
    private descuentoRepository: DescuentoRepository,
    @inject(CashRegisterService)
    private cashRegisterService: CashRegisterService,
    @inject(CreditoService) private creditoService: CreditoService,
    @inject(ResumenCajaDiarioRepository)
    private resumenRepository: ResumenCajaDiarioRepository,
    @inject(CreditoService) private service: CreditoService
  ) {}

  async addTransactionToQueue(data: ICreateTransactionProps) {
    const result = await this.createTransaction(data);
    return result;
  }

  private async initInventory(venta: Partial<ITransaccionCreate>, userId: string) {
    const listInventarioSucursalIds = venta.products?.map((d) => d.inventarioSucursalId) || [];
    await this.inventoryManagementService.init({
      userId,
      branchId: venta.sucursalId!,
      listInventarioSucursalId: listInventarioSucursalIds,
    });
  }

  private async createSale(venta: Partial<ITransaccionCreate>) {
    return this.repository.create({
      usuarioId: new mongoose.Types.ObjectId(venta.userId!),
      sucursalId: new mongoose.Types.ObjectId(venta.sucursalId!),
      subtotal: new mongoose.Types.Decimal128(venta.subtotal!.toString()),
      total: new mongoose.Types.Decimal128(venta.total!.toString()),
      descuento: new mongoose.Types.Decimal128(venta.discount?.toString() || '0'),
      fechaRegistro: getDateInManaguaTimezone(),
      tipoTransaccion: venta.tipoTransaccion,
      paymentMethod: venta.paymentMethod,
      entidadId: new mongoose.Types.ObjectId(venta.entidadId!),
      estadoTrasaccion: venta.paymentMethod === 'credit' ? 'PENDIENTE' : 'PAGADA',
      cajaId: new mongoose.Types.ObjectId(venta.cajaId!),
    });
  }

  private async applyDiscounts(detalles: any[]) {
    await Promise.all(
      detalles.map(async ({ newDetalleVenta, item }) => {
        if (!item.discount) return;

        let tipoAplicacion: ITipoDescuentoEntidad = item.discount.type === 'grupo' ? 'Group' : 'Product';
        const descuentoId =
          tipoAplicacion === 'Product'
            ? formatObejectId((await this.descuentoRepository.getDescuentoProductoByDescuentoId(item.discount.id))?._id)
            : formatObejectId(
                (await this.descuentoRepository.getDescuentoGrupoByDescuentoId(item.discount.id))?.descuentoId
              );

        if (!descuentoId) return;

        const ventaDescuento = {
          detalleVentaId: formatObejectId(newDetalleVenta._id),
          descuentosProductosId: tipoAplicacion === 'Product' ? descuentoId : undefined,
          descuentoGrupoId: tipoAplicacion === 'Group' ? descuentoId : undefined,
          tipoAplicacion,
          valor: new mongoose.Types.Decimal128(item.discount.percentage.toString()),
          tipo: ITipoDescuento.PORCENTAJE,
          monto: new mongoose.Types.Decimal128(item.discount.amount.toString()),
        };

        await this.repository.createVentaDescuentosAplicados(ventaDescuento);
      })
    );
  }

  private async handleInventory(newSale: ITransaccion, venta: Partial<ITransaccionCreate>, user: CustomJwtPayload) {
    const listInventarioSucursal: IInventarioSucursal[] = [];

    await Promise.all(
      venta.products!.map(async (item) => {
        const data = {
          inventarioSucursalId: new mongoose.Types.ObjectId(item.inventarioSucursalId),
          quantity: item.quantity,
          isNoSave: true,
          tipoMovimiento:
            newSale.tipoTransaccion === TypeTransaction.VENTA
              ? TipoMovimientoInventario.VENTA
              : TipoMovimientoInventario.COMPRA,
        };

        const inventarioSucursal =
          newSale.tipoTransaccion === 'VENTA'
            ? await this.inventoryManagementService.subtractQuantity(data)
            : await this.inventoryManagementService.addQuantity({
                ...data,
                cost: item.costoUnitario,
              });

        if (inventarioSucursal) {
          if (inventarioSucursal.stock <= inventarioSucursal.puntoReCompra) {
            listInventarioSucursal.push(inventarioSucursal);
          }
        }
      })
    );

    if (listInventarioSucursal.length > 0) {
      const productListReOrder = listInventarioSucursal.map((item) => ({
        name: (item.productoId as IProducto).nombre,
        currentQuantity: item.stock,
        reorderPoint: item.puntoReCompra,
      }));

      notifyTelergramReorderThreshold(
        user.username,
        (listInventarioSucursal[0].sucursalId as ISucursal).nombre,
        productListReOrder,
        user.chatId
      );
    }

    return listInventarioSucursal;
  }

  private async handleTransactionDetails(newSale: ITransaccion, venta: Partial<ITransaccionCreate>) {
    const detalles = await Promise.all(
      venta.products!.map(async (item) => {
        let tipoAplicacion: ITipoDescuentoEntidad = item.discount?.type === 'grupo' ? 'Group' : 'Product';

        const detalleVenta = {
          ventaId: newSale._id as mongoose.Types.ObjectId,
          productoId: new mongoose.Types.ObjectId(item.productId),
          precio: new mongoose.Types.Decimal128(item.price.toString()),
          cantidad: item.quantity,
          subtotal: new mongoose.Types.Decimal128((item.price * item.quantity).toString()),
          total: new mongoose.Types.Decimal128((item.price * item.quantity - (item.discount?.amount || 0)).toString()),
          descuento: new mongoose.Types.Decimal128((item.discount?.amount || 0).toString()),
          tipoCliente: item.clientType,
          tipoDescuentoEntidad: tipoAplicacion,
          deleted_at: null,
        };

        const newDetalleVenta = await this.repository.createDetalleVenta(detalleVenta);
        return { newDetalleVenta, item };
      })
    );

    // Asignar los detalles a la venta
    newSale.transactionDetails = detalles.map((d) => d.newDetalleVenta._id as mongoose.Types.ObjectId);
    await newSale.save();

    // Manejar descuentos
    await this.applyDiscounts(detalles);
  }

  private async handleCredit(newSale: ITransaccion, venta: Partial<ITransaccionCreate>) {
    const credito = {
      sucursalId: formatObejectId(newSale.sucursalId),
      entidadId: formatObejectId(newSale.entidadId),
      transaccionId: formatObejectId(newSale._id),
      tipoCredito: newSale.tipoTransaccion === TypeTransaction.VENTA ? TypeCredito.VENTA : TypeCredito.COMPRA,
      modalidadCredito: venta.credito?.modalidadCredito as ModalidadCredito,
      saldoCredito: new mongoose.Types.Decimal128(venta?.total?.toString() as string),
      plazoCredito: venta.credito?.plazoCredito,
      cuotaMensual: venta.credito?.cuotaMensual as mongoose.Types.Decimal128,
      pagoMinimoMensual: venta.credito?.pagoMinimoMensual as mongoose.Types.Decimal128,
      fechaVencimiento: getDateInManaguaTimezone(),
    };

    await this.creditoService.createCredito(credito);
  }

  private async updateCashRegisterAndSummary(newSale: ITransaccion, venta: Partial<ITransaccionCreate>) {
    await this.inventoryManagementService.updateAllBranchInventory();
    await this.inventoryManagementService.saveAllMovimientoInventario();
    await newSale.save();

    if (venta.paymentMethod === 'cash') {
      await this.cashRegisterService.actualizarMontoEsperadoByTrasaccion({
        data: {
          ...venta,
          id: formatObejectId(newSale._id),
        } as ITransactionCreateCaja,
      });
    }

    await this.resumenRepository.addTransactionDailySummary(newSale);

    if (newSale.paymentMethod === 'credit') {
      await this.handleCredit(newSale, venta);
    }
  }

  async createTransaction(data: ICreateTransactionProps): Promise<Partial<ITransaccionCreate>> {
    const { venta, user } = data;

    try {
      // 1️⃣ Inicializar Inventario
      await this.initInventory(venta, user._id);

      // 2️⃣ Crear la venta
      const newSale = await this.createSale(venta);

      // 3️⃣ Manejar detalles de venta y descuentos
      await this.handleTransactionDetails(newSale, venta);

      // 4️⃣ Manejar inventario
      await this.handleInventory(newSale, venta, user);

      // 5️⃣ Actualizar caja, resumen y manejar crédito si aplica
      await this.updateCashRegisterAndSummary(newSale, venta);

      return { ...venta, id: formatObejectId(newSale._id).toString() };
    } catch (error) {
      console.error(error);
      throw new Error(error.message);
    }
  }

  async findByTypeAndBranch(sucursalId: string, type: TypeTransaction): Promise<ITransaccionResponse[]> {
    // Obtener todas las ventas de la sucursal especificada
    const transaccion = await this.repository.findByTypeAndBranch(sucursalId, type);
    let transactionDto: ITransaccionResponse[] = await this.mapperDataAll(transaccion);

    return transactionDto;
  }

  async findDevolucionesBySucursalId(
    sucursalId: string,
    typeTransaction: TypeTransaction
  ): Promise<ITransaccionCreate[]> {
    const ventas = await this.repository.findByTypeAndBranchDevolucion(sucursalId, typeTransaction);

    let ventasDto: ITransaccionCreate[] = [];

    // Iterar sobre cada venta y obtener los detalles de venta
    for (const venta of ventas) {
      const ventaDto = (await this.mapperDataReturn(
        venta,
        venta.transactionDetails as IDetalleTransaccion[]
      )) as ITransaccionCreate;
      ventasDto.push(ventaDto);
    }

    return ventasDto;
  }

  async findAllVentaBySucursalIdAndUserId(sucursalId: string, userId: string): Promise<ITransaccionCreate[]> {
    const ventas = await this.repository.findAllVentaBySucursalIdAndUserId(sucursalId, userId);

    let ventasDto: ITransaccionCreate[] = [];

    // Iterar sobre cada venta y obtener los detalles de venta
    for (const venta of ventas) {
      const detalleVenta = await this.repository.findAllDetalleVentaByVentaId((venta._id as Types.ObjectId).toString());
      const ventaDto = (await this.mapperData(venta, detalleVenta)) as ITransaccionCreate;
      ventasDto.push(ventaDto);
    }

    return ventasDto;
  }

  async getAllVentasBySucursalIdAndUserId(sucursalId: string, userId: string): Promise<ITransaccion[]> {
    return this.repository.findAllVentaBySucursalIdAndUserId(sucursalId, userId);
  }

  async getTransactionById(id: string): Promise<ITransaccionCreate | null> {
    let venta = (await this.repository.findTransaccionById(id)) as ITransaccion;

    let ventaDto: ITransaccionCreate = (await this.mapperData(
      venta,
      venta.transactionDetails as IDetalleTransaccion[]
    )) as ITransaccionCreate;

    return ventaDto;
  }

  async getTransactionByIdNoDto(id: string): Promise<ITransaccionNoDto | null> {
    let venta = (await this.repository.findTransaccionById(id)) as ITransaccion;

    return {
      transaccion: venta,
      datalleTransaccion: venta.transactionDetails as IDetalleTransaccion[],
    };
  }

  async mapperDataReturn(
    venta: Partial<ITransaccion>,
    detalleVenta: IDetalleTransaccion[]
  ): Promise<ITransaccionResponse> {
    let products: ITrasaccionProductoResponse[] = [];

    for await (const detalle of detalleVenta) {
      let descuento: IDescuentoAplicado | null = null;

      let producto: ITrasaccionProductoResponse = {
        productId: ((detalle.productoId as IProducto)._id as mongoose.Types.ObjectId).toString(),
        clientType: detalle.tipoCliente,
        productName: (detalle.productoId as IProducto).nombre,
        quantity: detalle.cantidad,
        price: Number(detalle.precio),
        ventaId: (venta._id as mongoose.Types.ObjectId).toString(),
        inventarioSucursalId: '',
        groupId: '',
        discount: descuento,
        costoUnitario: 0,
        ajusteACobrar: detalle.ajusteACobrar,
      };

      products.push(producto);
    }

    let tipoTransaccionOrigen = (
      venta.transaccionOrigenId ? (venta.transaccionOrigenId as ITransaccion).tipoTransaccion : null
    ) as TypeTransaction;
    let user = venta.usuarioId as IUser;

    let ventaDto: ITransaccionResponse = {
      userId: (user._id as Types.ObjectId).toString(),
      sucursalId: venta?.sucursalId?.toString() as string,
      subtotal: Number(venta.subtotal),
      total: Number(venta.total),
      discount: Number(venta.descuento),
      fechaRegistro: venta.fechaRegistro,
      products: products,
      paymentMethod: venta?.paymentMethod as TypePaymentMethod,
      tipoTransaccion: venta.tipoTransaccion as TypeTransaction,
      id: (venta._id as mongoose.Types.ObjectId).toString(),
      tipoTransaccionOrigen,
      totalAjusteACobrar: venta?.totalAjusteACobrar as Types.Decimal128,
      username: user.username,
    };

    return ventaDto;
  }

  async mapperData(venta: ITransaccion, detalleVenta: IDetalleTransaccion[]): Promise<ITransaccionResponse> {
    let products: ITrasaccionProductoResponse[] = [];

    for await (const detalle of detalleVenta) {
      let descuento: IDescuentoAplicado | null = null;

      if (!compareToCero(detalle.descuento)) {
        let descuentoAplicado = await this.repository.findVentaDescuentosAplicadosByDetalleVentaId(
          (detalle._id as mongoose.Types.ObjectId).toString()
        );

        if (descuentoAplicado) {
          let tipoAplicacion = descuentoAplicado.tipoAplicacion;
          let descuentoTipo = descuentoAplicado.descuentosProductosId
            ? descuentoAplicado.descuentosProductosId
            : descuentoAplicado.descuentoGrupoId;
          let descuentoId = (descuentoTipo as IDescuentosProductos).descuentoId as IDescuento;

          let productId = descuentoAplicado.descuentosProductosId
            ? (descuentoAplicado.descuentosProductosId as IDescuentosProductos).productId.toString()
            : null;
          let groupId = descuentoAplicado.descuentoGrupoId
            ? (descuentoAplicado.descuentoGrupoId as IDescuentoGrupo).grupoId.toString()
            : null;

          let sucursalId = descuentoAplicado.descuentosProductosId
            ? (
                (descuentoAplicado.descuentosProductosId as IDescuentosProductos)?.sucursalId as mongoose.Types.ObjectId
              )?.toString()
            : (
                (descuentoAplicado.descuentoGrupoId as IDescuentoGrupo)?.sucursalId as mongoose.Types.ObjectId
              )?.toString();

          descuento = {
            id: (descuentoId._id as mongoose.Types.ObjectId).toString(),
            name: descuentoId.nombre,
            amount: Number(descuentoAplicado.monto),
            percentage: Number(descuentoAplicado.valor),
            type: tipoAplicacion === 'Product' ? 'producto' : 'grupo',
            productId: productId,
            groupId: groupId,
            sucursalId: sucursalId || null,
            fechaInicio: descuentoId.fechaInicio,
            fechaFin: descuentoId.fechaFin,
            minimoCompra: descuentoId.minimoCompra,
            minimoCantidad: descuentoId.minimoCantidad,
            activo: descuentoId.activo,
            minimiType: descuentoId.minimiType,
            tipoDescuento: descuentoId.tipoDescuento,
          };
        }
      }

      let producto: ITrasaccionProductoResponse = {
        productId: ((detalle.productoId as IProducto)._id as mongoose.Types.ObjectId).toString(),
        clientType: detalle.tipoCliente,
        productName: (detalle.productoId as IProducto).nombre,
        quantity: detalle.cantidad,
        price: Number(detalle.precio),
        ventaId: (venta._id as mongoose.Types.ObjectId).toString(),
        inventarioSucursalId: '',
        groupId: '',
        discount: descuento,
        costoUnitario: 0,
        ajusteACobrar: cero128,
      };

      products.push(producto);
    }

    let user = venta.usuarioId as IUser;

    let ventaDto: ITransaccionResponse = {
      userId: (user._id as Types.ObjectId).toString(),
      sucursalId: venta.sucursalId.toString(),
      subtotal: Number(venta.subtotal),
      total: Number(venta.total),
      discount: Number(venta.descuento),
      fechaRegistro: venta.fechaRegistro,
      products: products,
      paymentMethod: venta.paymentMethod,
      tipoTransaccion: venta.tipoTransaccion,
      id: (venta._id as mongoose.Types.ObjectId).toString(),
      tipoTransaccionOrigen: venta.tipoTransaccion,
      totalAjusteACobrar: venta.totalAjusteACobrar,
      username: user.username,
    };

    return ventaDto;
  }

  async mapperDataAll(ventas: ITransaccion[]): Promise<ITransaccionResponse[]> {
    const results = await Promise.all(
      ventas.map((venta) => this.mapperData(venta, venta.transactionDetails as IDetalleTransaccion[]))
    );

    return results;
  }

  async getAllDetalleVentaByVentaId(ventaId: string): Promise<IDetalleTransaccion[]> {
    return this.repository.findAllDetalleVentaByVentaId(ventaId);
  }

  async findDescuentoByDescuentoAplicado(descuentoAplicado: ITransaccionDescuentosAplicados): Promise<IDescuento> {
    let descuentoTipo = descuentoAplicado.descuentosProductosId
      ? descuentoAplicado.descuentosProductosId
      : descuentoAplicado.descuentoGrupoId;
    let descuentoId = (descuentoTipo as IDescuentosProductos).descuentoId as IDescuento;
    return descuentoId;
  }

  async createDevolucion(data: IDevolucionesCreate) {
    let transaccion = await this.getTransactionByIdNoDto(data.trasaccionOrigenId);
    let detalleTransaccionIds = transaccion?.transaccion.transactionDetails as mongoose.Types.ObjectId[];

    let descuentosAplicados = await this.descuentoRepository.findDescuentosAplicadosByDTId(detalleTransaccionIds);

    let totalDevolucion128 = cero128;
    let totalAjusteACobrar = cero128;
    let newTotalTransaccionOrigen = cero128;
    let subTotalTransaccionOrigen = cero128;

    if (!transaccion?.transaccion) {
      throw new Error('Transaccion no encontrada');
    }

    let sucursalIdStr = transaccion.transaccion.sucursalId.toString();

    let productIdsByBranch = data.products?.map((detalle) => detalle.productId) as string[];

    let dataInit: IInit = {
      userId: data.userId,
      branchId: sucursalIdStr,
      listInventarioSucursalId: [],
      listProductId: productIdsByBranch,
      searchWithProductId: true,
    };

    let listInventarioSucursal = await this.inventoryManagementService.init(dataInit);

    let sucursalId = transaccion.transaccion.sucursalId;
    let usuarioId = new mongoose.Types.ObjectId(data.userId!);
    let cajaId = new mongoose.Types.ObjectId(data.cajaId!);

    let getDetalleVenta = (productId: string) => {
      let productoIdObj = new mongoose.Types.ObjectId(productId);
      let detalleVenta = transaccion.datalleTransaccion.find(
        (item) =>
          ((item.productoId as IProducto)._id as mongoose.Types.ObjectId).toString() === productoIdObj.toString()
      );

      return detalleVenta;
    };

    let newVenta = {
      usuarioId: usuarioId,
      sucursalId: sucursalId,
      subtotal: totalDevolucion128,
      totalAjusteACobrar: totalAjusteACobrar,
      total: totalDevolucion128,
      descuento: new mongoose.Types.Decimal128('0'),
      deleted_at: null,
      fechaRegistro: getDateInManaguaTimezone(),
      tipoTransaccion: 'DEVOLUCION' as TypeTransaction,
      paymentMethod: transaccion.transaccion.paymentMethod,
      entidadId: (transaccion?.transaccion as ITransaccion).entidadId,
      estadoTrasaccion: tipoEstatusSales.DEVOLUCION,
      cajaId: cajaId,
      transaccionOrigenId: transaccion.transaccion._id as mongoose.Types.ObjectId,
    };

    const tipoTransaccionDevolucion =
      transaccion.transaccion.tipoTransaccion === TypeTransaction.VENTA
        ? TypeTransaction.COMPRA
        : TypeTransaction.VENTA;

    const newReturn = await this.repository.create(newVenta);

    await Promise.all(
      data.products!.map(async (element) => {
        // para lo devuelto siempre se devuelve el precio original
        let detalleTransaccionOrigen = getDetalleVenta(element.productId) as IDetalleTransaccion;
        let descuentoAplicado = descuentosAplicados.find(
          (item) => item.detalleVentaId === detalleTransaccionOrigen._id
        );
        let descuento = descuentoAplicado ? await this.findDescuentoByDescuentoAplicado(descuentoAplicado!) : null;
        let detalleTransaccionOrigenId = detalleTransaccionOrigen._id as mongoose.Types.ObjectId;
        let cantidadOriginal = new Types.Decimal128(detalleTransaccionOrigen.cantidad.toString());
        let productoId = new mongoose.Types.ObjectId(element.productId);

        let ajusteACobrar = cero128;

        let inventarioSucursal = listInventarioSucursal.find(
          (item) => formatObejectId((item.productoId as IProducto)._id).toString() === productoId.toString()
        ) as IInventarioSucursal;

        let inventarioSucursalId = inventarioSucursal._id as Types.ObjectId;

        let quantity128 = new mongoose.Types.Decimal128(element.quantity.toString());
        let cantidadRetenida = new Types.Decimal128((detalleTransaccionOrigen.cantidad - element.quantity).toString());

        let precioApplyDiscount = dividirDecimal128(detalleTransaccionOrigen.total, cantidadOriginal);

        let newPriceAplyDiscount = cero128;

        if (element.discountApplied && descuento) {
          let descuentoAplicadoId = (descuentoAplicado?._id as mongoose.Types.ObjectId).toString();
          let valorDescuento = new Types.Decimal128(descuento.valorDescuento.toString());

          let total = multiplicarDecimal128(inventarioSucursal.precio, cantidadRetenida);

          if (descuento.tipoDescuento === 'porcentaje') {
            let porcentaje = new Types.Decimal128((descuento.valorDescuento / 100).toString());

            let procentajeDelTotal = multiplicarDecimal128(total, porcentaje);

            let totalConDescuento = restarDecimal128(total, procentajeDelTotal);

            newPriceAplyDiscount = dividirDecimal128(totalConDescuento, cantidadRetenida);

            await this.descuentoRepository.updateDescuentoAplicado(descuentoAplicadoId.toString(), {
              monto: procentajeDelTotal,
            });
          } else if (descuento.tipoDescuento === 'valor') {
            let totalConDescuento = restarDecimal128(total, valorDescuento);

            let cienporciento = new Types.Decimal128('100');

            const porcentaje = multiplicarDecimal128(dividirDecimal128(valorDescuento, total), cienporciento);

            newPriceAplyDiscount = multiplicarDecimal128(totalConDescuento, cantidadRetenida);

            await this.descuentoRepository.updateDescuentoAplicado(descuentoAplicadoId.toString(), {
              valor: porcentaje,
            });
          }
        }

        let precio = element.discountApplied ? newPriceAplyDiscount : inventarioSucursal.precio;
        let subTotal128 = multiplicarDecimal128(inventarioSucursal.precio, quantity128);

        // logica para calcular el totalAjusteACobrar
        if (detalleTransaccionOrigen.total !== detalleTransaccionOrigen.subtotal && !element.discountApplied) {
          let nuevoTotalSinDescuento = multiplicarDecimal128(inventarioSucursal.precio, cantidadRetenida);
          let nuevoTotalConDescuento = multiplicarDecimal128(
            precioApplyDiscount,
            new Types.Decimal128(cantidadRetenida.toString())
          );

          ajusteACobrar = restarDecimal128(nuevoTotalSinDescuento, nuevoTotalConDescuento);

          totalAjusteACobrar = sumarDecimal128(totalAjusteACobrar, ajusteACobrar);

          await this.repository.deletedDescuentoAplicadoByTransaccionDetailsId(detalleTransaccionOrigenId.toString());

          detalleTransaccionOrigen.descuento = cero128;
        }

        // Actualizar el total de la transaccion segun si se aplica descuento
        let subtotalRetenido = multiplicarDecimal128(precio, cantidadRetenida);
        newTotalTransaccionOrigen = sumarDecimal128(
          newTotalTransaccionOrigen,
          multiplicarDecimal128(precio, cantidadRetenida)
        );
        subTotalTransaccionOrigen = sumarDecimal128(subTotalTransaccionOrigen, subtotalRetenido);

        let total = multiplicarDecimal128(precioApplyDiscount, quantity128);
        totalDevolucion128 = sumarDecimal128(totalDevolucion128, total);
        let tipoAplicacion: ITipoDescuentoEntidad = 'Product';

        let detalleVenta = {
          ventaId: newReturn._id as mongoose.Types.ObjectId,
          productoId: productoId,
          precio: precioApplyDiscount,
          cantidad: element.quantity,
          subtotal: subTotal128,
          total: total,
          descuento: cero128,
          deleted_at: null,
          tipoCliente: 'Regular' as 'Regular',
          tipoDescuentoEntidad: tipoAplicacion,
          ajusteACobrar,
        };

        let newdDetailReturn = await this.repository.createDetalleVenta(detalleVenta);

        if (transaccion.transaccion.tipoTransaccion === 'COMPRA') {
          let dataSubTractQuantity: ISubtractQuantity = {
            inventarioSucursalId: inventarioSucursalId,
            quantity: element.quantity,
            isNoSave: true,
            tipoMovimiento: TipoMovimientoInventario.DEVOLUCION,
          };

          let inventarioSucursal = (await this.inventoryManagementService.subtractQuantity(
            dataSubTractQuantity
          )) as IInventarioSucursal;

          if (inventarioSucursal.stock <= inventarioSucursal.puntoReCompra) {
            listInventarioSucursal.push(inventarioSucursal);
          }
        } else if (transaccion.transaccion.tipoTransaccion === 'VENTA') {
          let dataAddQuantity: IAddQuantity = {
            quantity: element.quantity,
            inventarioSucursalId: inventarioSucursalId,
            isNoSave: true,
            tipoMovimiento: TipoMovimientoInventario.DEVOLUCION,
          };

          await this.inventoryManagementService.addQuantity(dataAddQuantity);
        }

        (newReturn.transactionDetails as mongoose.Types.ObjectId[]).push(
          newdDetailReturn._id as mongoose.Types.ObjectId
        );

        if (compareDecimal128(newTotalTransaccionOrigen, cero128)) {
          if (detalleTransaccionOrigen) {
            if (detalleTransaccionOrigen.cantidad === element.quantity) {
              detalleTransaccionOrigen.deleted_at = getDateInManaguaTimezone();
              await this.repository.updateDetailTransaction(
                formatObejectId(detalleTransaccionOrigen._id).toString(),
                detalleTransaccionOrigen
              );
            } else {
              detalleTransaccionOrigen.precio = precio;
              detalleTransaccionOrigen.subtotal = multiplicarDecimal128(inventarioSucursal.precio, cantidadRetenida);
              detalleTransaccionOrigen.total = multiplicarDecimal128(precio, cantidadRetenida);
              detalleTransaccionOrigen.cantidad = parseInt(cantidadRetenida.toString());
              await this.repository.updateDetailTransaction(
                formatObejectId(detalleTransaccionOrigen._id).toString(),
                detalleTransaccionOrigen
              );
            }
          }
        }
      })
    );

    newReturn.totalAjusteACobrar = totalAjusteACobrar;
    newReturn.subtotal = totalDevolucion128;
    newReturn.total = restarDecimal128(totalDevolucion128, totalAjusteACobrar);

    if (compareToCero(newTotalTransaccionOrigen)) {
      transaccion.transaccion.deleted_at = getDateInManaguaTimezone();
      transaccion.transaccion.estadoTrasaccion = tipoEstatusSales.DEVOLUCION;

      //aqui da error
      // await transaccion.transaccion.save();
      await this.repository.update(formatObejectId(transaccion.transaccion._id).toString(), transaccion.transaccion);
    } else {
      let isAplyDiscoundTransaction = data.products?.some((item) => item.discountApplied);
      if (!isAplyDiscoundTransaction) {
        transaccion.transaccion.descuento = cero128;
      }
      transaccion.transaccion.subtotal = subTotalTransaccionOrigen;
      transaccion.transaccion.total = newTotalTransaccionOrigen;
      await this.repository.update(formatObejectId(transaccion.transaccion._id).toString(), transaccion.transaccion);
    }

    await this.inventoryManagementService.updateAllBranchInventory();
    await this.inventoryManagementService.saveAllMovimientoInventario();

    let ventaActualizar = {
      id: newReturn._id as Types.ObjectId,
      tipoTransaccion: tipoTransaccionDevolucion,
      cajaId: (newReturn.cajaId as Types.ObjectId).toString(),
      userId: data.userId,
      total: parseFloat(totalDevolucion128.toString()),
      subtotal: parseFloat(totalDevolucion128.toString()),
      monto: data.monto,
      cambioCliente: 0,
    } as ITransactionCreateCaja;

    const datosActualizar = {
      data: ventaActualizar,
    };

    let caja: ICaja | null = null;

    if (transaccion.transaccion.paymentMethod === 'credit') {
      const dineroADevolver = await this.creditoService.returnTransactionById(
        data.trasaccionOrigenId,
        totalDevolucion128
      );

      ventaActualizar.total = dineroADevolver;
      ventaActualizar.monto = dineroADevolver;

      caja = await this.cashRegisterService.actualizarMontoEsperadoByTrasaccion(datosActualizar!);
    }

    await newReturn.save();

    if (transaccion.transaccion.paymentMethod === 'cash') {
      caja = await this.cashRegisterService.actualizarMontoEsperadoByTrasaccion(datosActualizar!);
    }

    await this.resumenRepository.addTransactionDailySummary(newReturn);

    let devolucionMapeada = await this.getTransactionById(formatObejectId(newReturn._id).toString());

    let transaccionActualizada = await this.getTransactionById(formatObejectId(transaccion.transaccion._id).toString());

    return {
      devolucion: devolucionMapeada,
      transaccionActualizada,
      caja: caja,
    };
  }

  async getResumenDiarioByCashierId(id: string): Promise<IResumenCajaDiario | null> {
    let cashier = new mongoose.Types.ObjectId(id);
    const resumenDiario = await this.resumenRepository.findByDateAndCashier(cashier);
    return resumenDiario;
  }

  private async createReturnTransaction(
    transaccion: ITransaccion,
    usuarioId: Types.ObjectId,
    sucursalId: Types.ObjectId,
    cajaId: Types.ObjectId,
    totalDevolucion128: Types.Decimal128,
    totalAjusteACobrar: Types.Decimal128
  ) {
    return this.repository.create({
      usuarioId: usuarioId,
      sucursalId: sucursalId,
      subtotal: cero128,
      totalAjusteACobrar: totalAjusteACobrar,
      total: totalDevolucion128,
      descuento: cero128,
      fechaRegistro: getDateInManaguaTimezone(),
      tipoTransaccion: 'DEVOLUCION' as TypeTransaction,
      paymentMethod: transaccion.paymentMethod,
      entidadId: transaccion.entidadId,
      estadoTrasaccion: tipoEstatusSales.DEVOLUCION,
      cajaId: cajaId,
      transaccionOrigenId: formatObejectId(transaccion._id),
    });
  }

  private async updateOriginalTransaction(
    transaccion: any,
    newTotalTransaccionOrigen: Types.Decimal128,
    subTotalTransaccionOrigen: Types.Decimal128,
    data: IDevolucionesCreate
  ) {
    if (compareToCero(newTotalTransaccionOrigen)) {
      transaccion.transaccion.deleted_at = getDateInManaguaTimezone();
      transaccion.transaccion.estadoTrasaccion = tipoEstatusSales.DEVOLUCION;

      await this.repository.update(formatObejectId(transaccion.transaccion._id).toString(), transaccion.transaccion);
    } else {
      let isAplyDiscoundTransaction = data.products?.some((item) => item.discountApplied);
      if (!isAplyDiscoundTransaction) {
        transaccion.transaccion.descuento = cero128;
      }
      transaccion.transaccion.subtotal = subTotalTransaccionOrigen;
      transaccion.transaccion.total = newTotalTransaccionOrigen;
      await this.repository.update(formatObejectId(transaccion.transaccion._id).toString(), transaccion.transaccion);
    }
  }

  private async finalizeInventoryOperations() {
    await this.inventoryManagementService.updateAllBranchInventory();
    await this.inventoryManagementService.saveAllMovimientoInventario();
  }

  private async handlePaymentOperations(
    transaccion: ITransaccion,
    data: IDevolucionesCreate,
    newReturn: ITransaccion,
    totalDevolucion128: Types.Decimal128,
    tipoTransaccionDevolucion: TypeTransaction
  ) {
    let ventaActualizar = {
      id: newReturn._id as Types.ObjectId,
      tipoTransaccion: tipoTransaccionDevolucion,
      cajaId: (newReturn.cajaId as Types.ObjectId).toString(),
      userId: data.userId,
      total: parseFloat(totalDevolucion128.toString()),
      subtotal: parseFloat(totalDevolucion128.toString()),
      monto: data.monto,
      cambioCliente: 0,
    } as ITransactionCreateCaja;

    const datosActualizar = {
      data: ventaActualizar,
    };

    let caja: ICaja | null = null;

    if (transaccion.paymentMethod === 'credit') {
      const dineroADevolver = await this.creditoService.returnTransactionById(
        data.trasaccionOrigenId,
        totalDevolucion128
      );

      ventaActualizar.total = dineroADevolver;
      ventaActualizar.monto = dineroADevolver;

      caja = await this.cashRegisterService.actualizarMontoEsperadoByTrasaccion(datosActualizar!);
    }

    if (transaccion.paymentMethod === 'cash') {
      caja = await this.cashRegisterService.actualizarMontoEsperadoByTrasaccion(datosActualizar!);
    }

    return { caja, ventaActualizar };
  }

  private async getFinalResults(
    newReturn: ITransaccion,
    transaccion: ITransaccion,
    listDetailTransaction: IDetalleTransaccion[]
  ) {
    await this.resumenRepository.addTransactionDailySummary(newReturn);

    // let devolucionMapeada = await this.getTransactionById(formatObejectId(newReturn._id).toString());

    let devolucionMapeada: ITransaccionCreate = (await this.mapperData(
      newReturn,
      listDetailTransaction
    )) as ITransaccionCreate;

    // let transaccionActualizada = await this.getTransactionById(formatObejectId(transaccion._id).toString());
    let transaccionActualizada: ITransaccionCreate = (await this.mapperData(
      transaccion,
      transaccion.transactionDetails as IDetalleTransaccion[]
    )) as ITransaccionCreate;

    return { devolucion: devolucionMapeada, transaccionActualizada };
  }

  private async updateReturnTransaction(
    newReturn: ITransaccion,
    totalDevolucion128: Types.Decimal128,
    totalAjusteACobrar: Types.Decimal128
  ) {
    newReturn.totalAjusteACobrar = totalAjusteACobrar;
    newReturn.subtotal = restarDecimal128(totalDevolucion128, totalDevolucion128);
    newReturn.total = restarDecimal128(totalDevolucion128, totalAjusteACobrar);

    await this.repository.update(formatObejectId(newReturn._id).toString(), newReturn);
  }

  async createDevolucion2(data: IDevolucionesCreate) {
    const transaccion = await this.validateTransactionExists(data.trasaccionOrigenId);
    const { sucursalId, usuarioId, cajaId } = this.getTransactionMetadata(transaccion, data);
    const descuentosAplicados = await this.getAppliedDiscounts(transaccion);
    const tipoTransaccionDevolucion =
      transaccion.tipoTransaccion === TypeTransaction.VENTA ? TypeTransaction.COMPRA : TypeTransaction.VENTA;

    const newReturn = await this.createReturnTransaction(transaccion, usuarioId, sucursalId, cajaId, cero128, cero128);

    const {
      totalDevolucion128,
      totalAjusteACobrar,
      newTotalTransaccionOrigen,
      subTotalTransaccionOrigen,
      listDetailTransaction,
    } = await this.processReturnProducts(data, transaccion, descuentosAplicados, sucursalId, newReturn);

    await this.updateReturnTransaction(newReturn, totalDevolucion128, totalAjusteACobrar);

    await this.updateOriginalTransaction(transaccion, newTotalTransaccionOrigen, subTotalTransaccionOrigen, data);

    await this.finalizeInventoryOperations();

    const { caja, ventaActualizar } = await this.handlePaymentOperations(
      transaccion,
      data,
      newReturn,
      totalDevolucion128,
      tipoTransaccionDevolucion
    );

    const results = await this.getFinalResults(newReturn, transaccion, listDetailTransaction);

    return { ...results, caja };
  }

  // ----------------- Helper Functions ----------------- //

  private async validateTransactionExists(transactionId: string) {
    const transaccion = await this.getTransactionByIdNoDto(transactionId);
    if (!transaccion?.transaccion) {
      throw new Error('Transaccion no encontrada');
    }
    return transaccion.transaccion;
  }

  private getTransactionMetadata(transaccion: ITransaccion, data: IDevolucionesCreate) {
    return {
      sucursalId: formatObejectId(transaccion.sucursalId),
      usuarioId: formatObejectId(data.userId!),
      cajaId: formatObejectId(data.cajaId!),
      sucursalIdStr: transaccion.sucursalId.toString(),
    };
  }

  private async getAppliedDiscounts(transaccion: ITransaccion) {
    const detalleTransaccionIds = transaccion.transactionDetails as mongoose.Types.ObjectId[];
    return await this.descuentoRepository.findDescuentosAplicadosByDTId(detalleTransaccionIds);
  }

  private async processReturnProducts(
    data: IDevolucionesCreate,
    transaccion: ITransaccion,
    descuentosAplicados: ITransaccionDescuentosAplicados[],
    sucursalId: mongoose.Types.ObjectId,
    newReturn: ITransaccion
  ) {
    let totalDevolucion128 = cero128;
    let totalAjusteACobrar = cero128;
    let newTotalTransaccionOrigen = cero128;
    let subTotalTransaccionOrigen = cero128;

    const productIdsByBranch = data.products?.map((d) => d.productId) as string[];
    const listInventarioSucursal = await this.getBranchInventory(
      data.userId!,
      sucursalId.toString(),
      productIdsByBranch
    );

    const listDetailTransaction: IDetalleTransaccion[] = [];

    await Promise.all(
      data.products!.map(async (element) => {
        const { totalDev, ajusteCobrar, newTotalRetenido, subtotalRetenido } = await this.processSingleProduct(
          element,
          transaccion,
          descuentosAplicados,
          listInventarioSucursal,
          newReturn,
          listDetailTransaction
        );

        totalDevolucion128 = sumarDecimal128(totalDevolucion128, totalDev);
        totalAjusteACobrar = sumarDecimal128(totalAjusteACobrar, ajusteCobrar);
        newTotalTransaccionOrigen = sumarDecimal128(newTotalTransaccionOrigen, newTotalRetenido);
        subTotalTransaccionOrigen = sumarDecimal128(subTotalTransaccionOrigen, subtotalRetenido);
      })
    );

    return {
      totalDevolucion128,
      totalAjusteACobrar,
      newTotalTransaccionOrigen,
      subTotalTransaccionOrigen,
      listDetailTransaction,
    };
  }

  private async getBranchInventory(userId: string, branchId: string, productIds: string[]) {
    const dataInit: IInit = {
      userId: userId,
      branchId: branchId,
      listInventarioSucursalId: [],
      listProductId: productIds,
      searchWithProductId: true,
    };
    return await this.inventoryManagementService.init(dataInit);
  }

  private findTransactionDetail(transaccion: ITransaccion, productId: string) {
    return transaccion.transactionDetails.find(
      (item: IDetalleTransaccion) => formatObejectId((item.productoId as IProducto)._id).toString() === productId
    ) as IDetalleTransaccion;
  }

  private async getProductDiscounts(
    detalleTransaccionOrigen: IDetalleTransaccion,
    descuentosAplicados: ITransaccionDescuentosAplicados[]
  ) {
    let descuentoAplicado = descuentosAplicados.find((item) => item.detalleVentaId === detalleTransaccionOrigen._id);

    let descuento = descuentoAplicado ? await this.findDescuentoByDescuentoAplicado(descuentoAplicado!) : null;

    return { descuento, descuentoAplicado };
  }

  private findBranchInventory(listInventarioSucursal: IInventarioSucursal[], productId: string) {
    return listInventarioSucursal.find(
      (item) => formatObejectId((item.productoId as IProducto)._id).toString() === productId
    ) as IInventarioSucursal;
  }

  private async handleDiscountApplication(
    element: IDevolucionesProducto,
    descuento: IDescuento | null,
    descuentoAplicado: ITransaccionDescuentosAplicados | undefined,
    detalleTransaccionOrigen: IDetalleTransaccion,
    inventarioSucursal: IInventarioSucursal
  ) {
    let newPriceAplyDiscount = cero128;
    let ajusteACobrar = cero128;
    const cantidadRetenida = new Types.Decimal128((detalleTransaccionOrigen.cantidad - element.quantity).toString());
    const detalleTransaccionOrigenId = detalleTransaccionOrigen._id as mongoose.Types.ObjectId;

    if (element.discountApplied && descuento) {
      const total = multiplicarDecimal128(inventarioSucursal.precio, cantidadRetenida);
      const descuentoAplicadoId = (descuentoAplicado?._id as mongoose.Types.ObjectId).toString();
      const valorDescuento = new Types.Decimal128(descuento.valorDescuento.toString());

      if (descuento.tipoDescuento === 'porcentaje') {
        const porcentaje = new Types.Decimal128((descuento.valorDescuento / 100).toString());
        const procentajeDelTotal = multiplicarDecimal128(total, porcentaje);
        const totalConDescuento = restarDecimal128(total, procentajeDelTotal);

        newPriceAplyDiscount = dividirDecimal128(totalConDescuento, cantidadRetenida);

        await this.descuentoRepository.updateDescuentoAplicado(descuentoAplicadoId, { monto: procentajeDelTotal });
      } else if (descuento.tipoDescuento === 'valor') {
        const totalConDescuento = restarDecimal128(total, valorDescuento);
        const cienporciento = new Types.Decimal128('100');
        const porcentaje = multiplicarDecimal128(dividirDecimal128(valorDescuento, total), cienporciento);

        newPriceAplyDiscount = multiplicarDecimal128(totalConDescuento, cantidadRetenida);

        await this.descuentoRepository.updateDescuentoAplicado(descuentoAplicadoId, { valor: porcentaje });
      }
    }

    // Calcular ajuste si corresponde
    if (detalleTransaccionOrigen.total !== detalleTransaccionOrigen.subtotal && !element.discountApplied) {
      const precioApplyDiscount = dividirDecimal128(
        detalleTransaccionOrigen.total,
        new Types.Decimal128(detalleTransaccionOrigen.cantidad.toString())
      );

      const nuevoTotalSinDescuento = multiplicarDecimal128(inventarioSucursal.precio, cantidadRetenida);

      const nuevoTotalConDescuento = multiplicarDecimal128(precioApplyDiscount, cantidadRetenida);

      ajusteACobrar = restarDecimal128(nuevoTotalSinDescuento, nuevoTotalConDescuento);

      await this.repository.deletedDescuentoAplicadoByTransaccionDetailsId(detalleTransaccionOrigenId.toString());
      detalleTransaccionOrigen.descuento = cero128;
    }

    return {
      newPriceAplyDiscount: newPriceAplyDiscount || inventarioSucursal.precio,
      ajusteACobrar,
    };
  }

  private async calculateTotals(
    detalleTransaccionOrigen: IDetalleTransaccion,
    element: { productId: string; quantity: number },
    inventarioSucursal: IInventarioSucursal,
    precio: mongoose.Types.Decimal128,
    quantity128: mongoose.Types.Decimal128
  ) {
    // Validaciones iniciales
    if (!detalleTransaccionOrigen || !inventarioSucursal) {
      throw new Error('Datos incompletos para cálculo de totales');
    }

    const cantidadOriginal = new Types.Decimal128(detalleTransaccionOrigen.cantidad.toString());
    const cantidadRetenida = new Types.Decimal128((detalleTransaccionOrigen.cantidad - element.quantity).toString());

    // Calcular precio original aplicando descuento inicial
    const precioApplyDiscount = dividirDecimal128(detalleTransaccionOrigen.total, cantidadOriginal);

    // Calcular total devolución
    const totalDev = multiplicarDecimal128(precioApplyDiscount, quantity128);

    // Calcular nuevos totales para transacción original
    const subtotalRetenido = multiplicarDecimal128(precio, cantidadRetenida);
    const newTotalRetenido = multiplicarDecimal128(precio, cantidadRetenida);

    if (compareDecimal128(newTotalRetenido, cero128)) {
      if (detalleTransaccionOrigen) {
        if (detalleTransaccionOrigen.cantidad === element.quantity) {
          detalleTransaccionOrigen.deleted_at = getDateInManaguaTimezone();
          await this.repository.updateDetailTransaction(
            formatObejectId(detalleTransaccionOrigen._id).toString(),
            detalleTransaccionOrigen
          );
        } else {
          detalleTransaccionOrigen.precio = precio;
          detalleTransaccionOrigen.subtotal = multiplicarDecimal128(inventarioSucursal.precio, cantidadRetenida);
          detalleTransaccionOrigen.total = multiplicarDecimal128(precio, cantidadRetenida);
          detalleTransaccionOrigen.cantidad = parseInt(cantidadRetenida.toString());
          await this.repository.updateDetailTransaction(
            formatObejectId(detalleTransaccionOrigen._id).toString(),
            detalleTransaccionOrigen
          );
        }
      }
    }

    return {
      totalDev,
      newTotalRetenido,
      subtotalRetenido,
    };
  }

  private async updateInventory(
    element: IDevolucionesProducto,
    transaccion: ITransaccion,
    inventarioSucursal: IInventarioSucursal,
    listInventarioSucursal: IInventarioSucursal[]
  ) {
    let inventarioSucursalId = inventarioSucursal._id as mongoose.Types.ObjectId;
    if (transaccion.tipoTransaccion === 'COMPRA') {
      let dataSubTractQuantity: ISubtractQuantity = {
        inventarioSucursalId: inventarioSucursalId,
        quantity: element.quantity,
        isNoSave: true,
        tipoMovimiento: TipoMovimientoInventario.DEVOLUCION,
      };

      let inventarioSucursal = (await this.inventoryManagementService.subtractQuantity(
        dataSubTractQuantity
      )) as IInventarioSucursal;

      if (inventarioSucursal.stock <= inventarioSucursal.puntoReCompra) {
        listInventarioSucursal.push(inventarioSucursal);
      }
    } else if (transaccion.tipoTransaccion === 'VENTA') {
      let dataAddQuantity: IAddQuantity = {
        quantity: element.quantity,
        inventarioSucursalId: inventarioSucursalId,
        isNoSave: true,
        tipoMovimiento: TipoMovimientoInventario.DEVOLUCION,
      };

      await this.inventoryManagementService.addQuantity(dataAddQuantity);
    }
  }

  private async createReturnDetail(
    newReturn: ITransaccion,
    element: IDevolucionesProducto,
    newPriceWithDiscount: Types.Decimal128,
    ajusteACobrar: Types.Decimal128,
    subtotal: Types.Decimal128,
    total: Types.Decimal128
  ) {
    return this.repository.createDetalleVenta({
      ventaId: formatObejectId(newReturn._id),
      productoId: new mongoose.Types.ObjectId(element.productId),
      precio: newPriceWithDiscount,
      cantidad: element.quantity,
      subtotal,
      total,
      descuento: cero128,
      tipoCliente: 'Regular' as 'Regular',
      tipoDescuentoEntidad: 'Product',
      ajusteACobrar,
    });
  }
  private async processSingleProduct(
    element: IDevolucionesProducto,
    transaccion: ITransaccion,
    descuentosAplicados: ITransaccionDescuentosAplicados[],
    listInventarioSucursal: IInventarioSucursal[],
    newReturn: ITransaccion,
    listDetailTransaction: IDetalleTransaccion[]
  ) {
    const detalleTransaccionOrigen = this.findTransactionDetail(transaccion, element.productId);
    const { descuento, descuentoAplicado } = await this.getProductDiscounts(
      detalleTransaccionOrigen,
      descuentosAplicados
    );

    const inventarioSucursal = this.findBranchInventory(listInventarioSucursal, element.productId);
    const quantity128 = new mongoose.Types.Decimal128(element.quantity.toString());

    const { newPriceAplyDiscount, ajusteACobrar } = await this.handleDiscountApplication(
      element,
      descuento,
      descuentoAplicado,
      detalleTransaccionOrigen,
      inventarioSucursal
    );

    const precio = element.discountApplied ? newPriceAplyDiscount : inventarioSucursal.precio;
    const { totalDev, newTotalRetenido, subtotalRetenido } = await this.calculateTotals(
      detalleTransaccionOrigen,
      element,
      inventarioSucursal,
      precio,
      quantity128
    );

    await this.updateInventory(element, transaccion, inventarioSucursal, listInventarioSucursal);
    let returnDetails = await this.createReturnDetail(
      newReturn,
      element,
      precio,
      ajusteACobrar,
      subtotalRetenido,
      newTotalRetenido
    );

    (newReturn.transactionDetails as Types.ObjectId[]).push(formatObejectId(returnDetails._id));

    listDetailTransaction.push(returnDetails);

    return {
      totalDev,
      ajusteCobrar: ajusteACobrar,
      newTotalRetenido,
      subtotalRetenido,
    };
  }
}
