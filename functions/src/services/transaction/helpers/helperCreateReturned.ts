import { inject, injectable } from 'tsyringe';
import { TransactionRepository } from '../../../repositories/transaction/transaction.repository';
import { DescuentoRepository } from '../../../repositories/transaction/descuento.repository';
import { InventoryManagementService } from '../../traslado/InventoryManagement.service';
import { CashRegisterService } from '../../utils/cashRegister.service';
import { CreditoService } from '../../credito/Credito.service';
import { ResumenCajaDiarioRepository } from '../../../repositories/caja/DailyCashSummary.repository';
import {
  IDevolucionesCreate,
  IDevolucionesProducto,
  ITransaccion,
  ITransaccionCreate,
  TypeTransaction,
} from '../../../models/transaction/Transaction.model';
import {
  cero128,
  compareDecimal128,
  compareToCero,
  dividirDecimal128,
  formatDecimal128,
  formatObejectId,
  multiplicarDecimal128,
  restarDecimal128,
  sumarDecimal128,
} from '../../../gen/handleDecimal128';
import { getDateInManaguaTimezone } from '../../../utils/date';
import { IDescuento } from '../../../models/transaction/Descuento.model';
import {
  ITransaccionDescuentosAplicados,
} from '../../../models/transaction/TransactionDescuentosAplicados.model';
import { IInventarioSucursal } from '../../../models/inventario/InventarioSucursal.model';
import { IAddQuantity, IInit, ISubtractQuantity, TipoMovimientoInventario } from '../../../interface/IInventario';
import { IProducto } from '../../../models/inventario/Producto.model';
import { ITransactionCreateCaja, TypeEstatusTransaction } from '../../../interface/ICaja';
import { Types } from 'mongoose';
import { ICaja } from '../../../models/cashRegister/CashRegister.model';
import { IDetalleTransaccion } from '../../../models/transaction/DetailTransaction.model';
import { HelperMapperTransaction } from './helperMapper';
import { IDescuentosProductos } from '../../../models/transaction/DescuentosProductos.model';

@injectable()
export class HelperCreateReturned {
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
    @inject(HelperMapperTransaction) private helperMapperTransaction: HelperMapperTransaction
  ) {}

  async createReturnTransaction(
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
      estadoTrasaccion: TypeEstatusTransaction.DEVOLUCION,
      cajaId: cajaId,
      transaccionOrigenId: formatObejectId(transaccion._id),
    });
  }

  async updateOriginalTransaction(
    transaccion: ITransaccion,
    newTotalTransaccionOrigen: Types.Decimal128,
    subTotalTransaccionOrigen: Types.Decimal128,
    data: IDevolucionesCreate,
    newTotalDiscountApplied: Types.Decimal128
  ) {
    if (compareToCero(newTotalTransaccionOrigen)) {
      transaccion.deleted_at = getDateInManaguaTimezone();
      transaccion.estadoTrasaccion = TypeEstatusTransaction.DEVOLUCION;

      await this.repository.update(formatObejectId(transaccion._id).toString(), transaccion);
    } else {
      let isAplyDiscoundTransaction = data.products?.some((item) => item.discountApplied);

      if (!isAplyDiscoundTransaction) {
        transaccion.descuento = cero128;
      }
      transaccion.descuento = newTotalDiscountApplied;
      transaccion.subtotal = subTotalTransaccionOrigen;
      transaccion.total = newTotalTransaccionOrigen;
      await this.repository.update(formatObejectId(transaccion._id).toString(), transaccion);
    }
  }

  async finalizeInventoryOperations() {
    await this.inventoryManagementService.updateAllBranchInventory();
    await this.inventoryManagementService.saveAllMovimientoInventario();
  }

  async handlePaymentOperations(
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
      esDineroExterno: data.esDineroExterno,
      montoExterno: data.montoExterno
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

  async getFinalResults(
    newReturn: ITransaccion,
    transaccion: ITransaccion,
    listDetailTransaction: IDetalleTransaccion[]
  ) {
    await this.resumenRepository.addTransactionDailySummary(newReturn);

    // let devolucionMapeada = await this.getTransactionById(formatObejectId(newReturn._id).toString());

    let devolucionMapeada: ITransaccionCreate = (await this.helperMapperTransaction.mapperDataReturn(
      newReturn,
      listDetailTransaction
    )) as ITransaccionCreate;

    // let transaccionActualizada = await this.getTransactionById(formatObejectId(transaccion._id).toString());
    let transaccionActualizada: ITransaccionCreate = (await this.helperMapperTransaction.mapperData(
      transaccion,
      transaccion.transactionDetails as IDetalleTransaccion[]
    )) as ITransaccionCreate;

    return { devolucion: devolucionMapeada, transaccionActualizada };
  }

  async updateReturnTransaction(
    newReturn: ITransaccion,
    totalDevolucion128: Types.Decimal128,
    totalAjusteACobrar: Types.Decimal128
  ) {
    newReturn.totalAjusteACobrar = totalAjusteACobrar;
    newReturn.subtotal = totalDevolucion128;
    newReturn.total = restarDecimal128(totalDevolucion128, totalAjusteACobrar);

    await this.repository.update(formatObejectId(newReturn._id).toString(), newReturn);
  }

  async validateTransactionExists(transactionId: string) {
    const transaccion = (await this.repository.findTransaccionById(transactionId)) as ITransaccion;
    if (!transaccion) {
      throw new Error('Transaccion no encontrada');
    }
    return transaccion;
  }

  getTransactionMetadata(transaccion: ITransaccion, data: IDevolucionesCreate) {
    return {
      sucursalId: formatObejectId(transaccion.sucursalId),
      usuarioId: formatObejectId(data.userId!),
      cajaId: formatObejectId(data.cajaId!),
      sucursalIdStr: transaccion.sucursalId.toString(),
    };
  }

  async getAppliedDiscounts(transaccion: ITransaccion) {
    const detalleTransaccionIds = transaccion.transactionDetails as Types.ObjectId[];
    return await this.descuentoRepository.findDescuentosAplicadosByDTId(detalleTransaccionIds);
  }

  async processReturnProducts(
    data: IDevolucionesCreate,
    transaccion: ITransaccion,
    descuentosAplicados: ITransaccionDescuentosAplicados[],
    sucursalId: Types.ObjectId,
    newReturn: ITransaccion
  ) {
    let totalDevolucion128 = cero128;
    let totalAjusteACobrar = cero128;
    let newTotalTransaccionOrigen = cero128;
    let subTotalTransaccionOrigen = cero128;
    let newTotalDiscountApplied = cero128;

    const productIdsByBranch = data.products?.map((d) => d.productId) as string[];
    const listInventarioSucursal = await this.getBranchInventory(
      data.userId!,
      sucursalId.toString(),
      productIdsByBranch
    );

    const listDetailTransaction: IDetalleTransaccion[] = [];

    await Promise.all(
      transaccion.transactionDetails.map(async (element) => {
        let detailsDevolucion = this.findTransactionDetailReturn(data.products!, element.productoId.toString());
        const { totalDev, ajusteCobrar, newTotalRetenido, subtotalRetenido, totalDiscountApplied } = await this.processSingleProduct(
          detailsDevolucion,
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
        newTotalDiscountApplied = sumarDecimal128(newTotalDiscountApplied, totalDiscountApplied);
      })
    );

    return {
      totalDevolucion128,
      totalAjusteACobrar,
      newTotalTransaccionOrigen,
      subTotalTransaccionOrigen,
      listDetailTransaction,
      newTotalDiscountApplied
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

  private findTransactionDetailReturn(product: IDevolucionesProducto[], productId: string) {
    return product.find(
      (item: IDevolucionesProducto) => item.productId === productId
    ) as IDevolucionesProducto;
  }

  async findDescuentoByDescuentoAplicado(descuentoAplicado: ITransaccionDescuentosAplicados): Promise<IDescuento> {
    let descuentoTipo = descuentoAplicado.descuentosProductosId
      ? descuentoAplicado.descuentosProductosId
      : descuentoAplicado.descuentoGrupoId;
    let descuentoId = (descuentoTipo as IDescuentosProductos).descuentoId as IDescuento;
    return descuentoId;
  }

  private async getProductDiscounts(
    detalleTransaccionOrigen: IDetalleTransaccion,
    descuentosAplicados: ITransaccionDescuentosAplicados[]
  ) {
    let descuentoAplicado = descuentosAplicados.find((item) => item.detalleVentaId.toString() === formatObejectId(detalleTransaccionOrigen._id).toString());

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
    const precioApplyDiscount = dividirDecimal128(detalleTransaccionOrigen.total, formatDecimal128(detalleTransaccionOrigen.cantidad));
    const cantidadRetenida = new Types.Decimal128((detalleTransaccionOrigen.cantidad - element.quantity).toString());
    const detalleTransaccionOrigenId = formatObejectId(detalleTransaccionOrigen._id);
    let totalDiscountApplied = cero128;


    if (element.discountApplied && descuento) {
      const total = multiplicarDecimal128(inventarioSucursal.precio, cantidadRetenida);
      const descuentoAplicadoId = formatObejectId(descuentoAplicado?._id).toString();
      const valorDescuento = new Types.Decimal128(descuento.valorDescuento.toString());

      if (descuento.tipoDescuento === 'porcentaje') {
        // esta bien por que es 0.10 y no 10% para hacer el calculo
        const porcentaje = new Types.Decimal128((descuento.valorDescuento / 100).toString());
        const procentajeDelTotal = multiplicarDecimal128(total, porcentaje);
        const totalConDescuento = restarDecimal128(total, procentajeDelTotal);
        totalDiscountApplied = procentajeDelTotal;

        newPriceAplyDiscount = dividirDecimal128(totalConDescuento, cantidadRetenida);

        await this.descuentoRepository.updateDescuentoAplicado(descuentoAplicadoId, { monto: procentajeDelTotal });
      } else if (descuento.tipoDescuento === 'valor') {

        totalDiscountApplied = valorDescuento;
        const totalConDescuento = restarDecimal128(total, valorDescuento);
        const cienporciento = new Types.Decimal128('100');
        const porcentaje = multiplicarDecimal128(dividirDecimal128(valorDescuento, total), cienporciento);

        newPriceAplyDiscount = multiplicarDecimal128(totalConDescuento, cantidadRetenida);

        await this.descuentoRepository.updateDescuentoAplicado(descuentoAplicadoId, { valor: porcentaje });
      }
    }

    // Calcular ajuste si corresponde
    if (detalleTransaccionOrigen.total !== detalleTransaccionOrigen.subtotal && !element.discountApplied) {
      const nuevoTotalSinDescuento = multiplicarDecimal128(inventarioSucursal.precio, cantidadRetenida);

      const nuevoTotalConDescuento = multiplicarDecimal128(precioApplyDiscount, cantidadRetenida);

      ajusteACobrar = restarDecimal128(nuevoTotalSinDescuento, nuevoTotalConDescuento);

      await this.repository.deletedDescuentoAplicadoByTransaccionDetailsId(detalleTransaccionOrigenId.toString());
      detalleTransaccionOrigen.descuento = cero128;
    }

    return {
      newPriceAplyDiscount: newPriceAplyDiscount || inventarioSucursal.precio,
      ajusteACobrar,
      precioApplyDiscount,
      totalDiscountApplied
    };
  }

  private async calculateTotals(
    detalleTransaccionOrigen: IDetalleTransaccion,
    element: { productId: string; quantity: number },
    inventarioSucursal: IInventarioSucursal,
    precio: Types.Decimal128,
    quantity128: Types.Decimal128
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
    const subTotalDev = multiplicarDecimal128(inventarioSucursal.precio, quantity128);

    // Calcular nuevos totales para transacción original
    const subtotalRetenido = multiplicarDecimal128(inventarioSucursal.precio, cantidadRetenida);
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
          // detalleTransaccionOrigen.precio = precio;
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
      subTotalDev,
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
    let inventarioSucursalId = formatObejectId(inventarioSucursal._id);
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
      productoId: formatObejectId(element.productId),
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
    const quantity128 = formatDecimal128(element.quantity);

    const { newPriceAplyDiscount, ajusteACobrar, precioApplyDiscount, totalDiscountApplied } = await this.handleDiscountApplication(
      element,
      descuento,
      descuentoAplicado,
      detalleTransaccionOrigen,
      inventarioSucursal
    );

    const precio = element.discountApplied ? newPriceAplyDiscount : inventarioSucursal.precio;
    const { totalDev, newTotalRetenido, subtotalRetenido, subTotalDev } = await this.calculateTotals(
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
      precioApplyDiscount,
      ajusteACobrar,
      subTotalDev,
      totalDev
    );

    (newReturn.transactionDetails as Types.ObjectId[]).push(formatObejectId(returnDetails._id));

    returnDetails.productoId = inventarioSucursal.productoId;

    listDetailTransaction.push(returnDetails);

    return {
      totalDev,
      ajusteCobrar: ajusteACobrar,
      newTotalRetenido,
      subtotalRetenido,
      totalDiscountApplied
    };
  }
}
