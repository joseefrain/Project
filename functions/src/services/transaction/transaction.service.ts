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
import { HelperCreateTransaction } from './helpers/helperCreateTransaction';
import { HelperCreateReturned } from './helpers/helperCreateReturned';
import { HelperMapperTransaction } from './helpers/helperMapper';

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
    @inject(ResumenCajaDiarioRepository) private resumenRepository: ResumenCajaDiarioRepository,
    @inject(HelperCreateTransaction) private helperCreateTransaction: HelperCreateTransaction,
    @inject(HelperCreateReturned) private helperCreateReturned: HelperCreateReturned,
    @inject(HelperMapperTransaction) private helperMapperTransaction: HelperMapperTransaction
  ) {}

  async addTransactionToQueue(data: ICreateTransactionProps) {
    const result = await this.createTransaction(data);
    return result;
  }

  async createTransaction(data: ICreateTransactionProps): Promise<Partial<ITransaccionCreate>> {
    const { venta, user } = data;

    try {
      // 1️⃣ Inicializar Inventario
      await this.helperCreateTransaction.initInventory(venta, user._id);

      // 2️⃣ Crear la venta
      const newSale = await this.helperCreateTransaction.createSale(venta);

      // 3️⃣ Manejar detalles de venta y descuentos
      await this.helperCreateTransaction.handleTransactionDetails(newSale, venta);

      // 4️⃣ Manejar inventario
      await this.helperCreateTransaction.handleInventory(newSale, venta, user);

      // 5️⃣ Actualizar caja, resumen y manejar crédito si aplica
      await this.helperCreateTransaction.updateCashRegisterAndSummary(newSale, venta);

      return { ...venta, id: formatObejectId(newSale._id).toString() };
    } catch (error) {
      console.error(error);
      throw new Error(error.message);
    }
  }

  async findByTypeAndBranch(sucursalId: string, type: TypeTransaction): Promise<ITransaccionResponse[]> {
    // Obtener todas las ventas de la sucursal especificada
    const transaccion = await this.repository.findByTypeAndBranch(sucursalId, type);
    let transactionDto: ITransaccionResponse[] = await this.helperMapperTransaction.mapperDataAll(transaccion);

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
      const ventaDto = (await this.helperMapperTransaction.mapperDataReturn(
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
      const ventaDto = (await this.helperMapperTransaction.mapperData(venta, detalleVenta)) as ITransaccionCreate;
      ventasDto.push(ventaDto);
    }

    return ventasDto;
  }

  async getAllVentasBySucursalIdAndUserId(sucursalId: string, userId: string): Promise<ITransaccion[]> {
    return this.repository.findAllVentaBySucursalIdAndUserId(sucursalId, userId);
  }

  async getTransactionById(id: string): Promise<ITransaccionCreate | null> {
    let venta = (await this.repository.findTransaccionById(id)) as ITransaccion;

    let ventaDto: ITransaccionCreate = (await this.helperMapperTransaction.mapperData(
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

  async createDevolucion2(data: IDevolucionesCreate) {
    const transaccion = await this.helperCreateReturned.validateTransactionExists(data.trasaccionOrigenId);
    const { sucursalId, usuarioId, cajaId } = this.helperCreateReturned.getTransactionMetadata(transaccion, data);
    const descuentosAplicados = await this.helperCreateReturned.getAppliedDiscounts(transaccion);
    let isSaleTransaction = transaccion.tipoTransaccion === TypeTransaction.VENTA;
    let tipoTransaccionDevolucion = isSaleTransaction ? TypeTransaction.COMPRA : TypeTransaction.VENTA;

    const newReturn = await this.helperCreateReturned.createReturnTransaction(transaccion, usuarioId, sucursalId, cajaId, cero128, cero128);

    const {
      totalDevolucion128,
      totalAjusteACobrar,
      newTotalTransaccionOrigen,
      subTotalTransaccionOrigen,
      listDetailTransaction,
    } = await this.helperCreateReturned.processReturnProducts(data, transaccion, descuentosAplicados, sucursalId, newReturn);

    await this.helperCreateReturned.updateReturnTransaction(newReturn, totalDevolucion128, totalAjusteACobrar);

    await this.helperCreateReturned.updateOriginalTransaction(transaccion, newTotalTransaccionOrigen, subTotalTransaccionOrigen, data);

    await this.helperCreateReturned.finalizeInventoryOperations();

    const { caja, ventaActualizar } = await this.helperCreateReturned.handlePaymentOperations(
      transaccion,
      data,
      newReturn,
      totalDevolucion128,
      tipoTransaccionDevolucion
    );

    const results = await this.helperCreateReturned.getFinalResults(newReturn, transaccion, listDetailTransaction);

    return { ...results, caja };
  }
}
