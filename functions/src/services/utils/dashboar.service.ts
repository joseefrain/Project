import { inject, injectable } from 'tsyringe';
import { CajaRepository } from '../../repositories/caja/cashRegister.repository';
import { MovimientoCajaRepository } from '../../repositories/caja/movimientoCaja.repository';
import { TransactionRepository } from '../../repositories/transaction/transaction.repository';
import { InventarioSucursalRepository } from '../../repositories/inventary/inventarioSucursal.repository';
import { ProductoRepository } from '../../repositories/inventary/Producto.repository';
import { IProducto } from '../../models/inventario/Producto.model';
import { Types } from 'mongoose';
import { IInventarioSucursal } from '../../models/inventario/InventarioSucursal.model';
import {
  cero128,
  compareDecimal128,
  multiplicarDecimal128,
  restarDecimal128,
  sumarDecimal128,
} from '../../gen/handleDecimal128';
import {
  IProductoMasVendido,
  IProductosMetrics,
  IResponseGetProductMetrics,
  IProductoConMasTotalVendidoDelDia,
  IProductoConMasGananciaNetaDelDia,
  ISaleMetricsOrNull,
  IPurshaceMetricsOrNull,
} from '../../interface/IDashboard';
import { isValidDateWithFormat } from '../../utils/date';
import { TypeTransaction } from '../../models/transaction/Transaction.model';

@injectable()
export class DashboardServices {
  constructor(
    @inject(CajaRepository) private repository: CajaRepository,
    @inject(MovimientoCajaRepository)
    private movimientoRepository: MovimientoCajaRepository,
    @inject(TransactionRepository)
    private transactionRepository: TransactionRepository,
    @inject(InventarioSucursalRepository)
    private inventarioSucursalRepository: InventarioSucursalRepository,
    @inject(ProductoRepository) private productoRepository: ProductoRepository
  ) {}

  async getTransactionMetrics(
    sucursalId: string,
    fechaInicioStr: string,
    fechaFinStr: string
  ): Promise<IResponseGetProductMetrics> {
    let fechaInicio = isValidDateWithFormat(fechaInicioStr, 'dd-MM-yyyy');
    let fechaFin = isValidDateWithFormat(fechaFinStr, 'dd-MM-yyyy');

    if (!fechaInicio || !fechaFin) throw new Error('Fecha no valida');

    const transacciones =
      await this.transactionRepository.findPaidTransactionsDayBySucursalId(
        sucursalId,
        fechaInicio.toJSDate(),
        fechaFin.toJSDate()
      );

    if (transacciones.length === 0)
      throw new Error('No hay transacciones para el día');

    let listProductoIdIdsSets = new Set<any>();

    transacciones.forEach((transaccion) => {
      transaccion.transactionDetails.forEach((detalle) => {
        listProductoIdIdsSets.add(detalle.productoId.toString()); // Agregar a Set
      });
    });

    // Si necesitas un array al final:
    const listProductoIdIds = Array.from(listProductoIdIdsSets);

    const branchInventoryList =
      await this.inventarioSucursalRepository.getListProductByProductIdsMetricas(
        sucursalId,
        listProductoIdIds
      );

    const productWithTransactions = {};

    transacciones.forEach((transaccion) => {
      transaccion.transactionDetails.forEach((detalle) => {
        let detalleCantidad128 = new Types.Decimal128(
          detalle.cantidad.toString()
        );
        let inventarioSucursal = branchInventoryList.find(
          (item) => item.productoId.toString() === detalle.productoId.toString()
        ) as IInventarioSucursal;
        let costoUnitario = multiplicarDecimal128(
          inventarioSucursal.costoUnitario,
          detalleCantidad128
        );
        let total128 = new Types.Decimal128(detalle.total.toString());

        let key = `${detalle.productoId}_${transaccion.tipoTransaccion}`;

        if (productWithTransactions[key]) {
          productWithTransactions[key].cantidad += detalle.cantidad;
          productWithTransactions[key].total = sumarDecimal128(
            productWithTransactions[key].total,
            detalle.total
          );
          productWithTransactions[key].costoUnitario = sumarDecimal128(
            productWithTransactions[key].costoUnitario,
            costoUnitario
          );
          productWithTransactions[key].gananciaNeta = sumarDecimal128(
            productWithTransactions[key].gananciaNeta,
            restarDecimal128(total128, costoUnitario)
          );
        } else {
          productWithTransactions[key] = {
            cantidad: detalle.cantidad,
            total: detalle.total,
            costoUnitario: costoUnitario,
            gananciaNeta: restarDecimal128(total128, costoUnitario),
          };
        }
      });
    });

    let venta: ISaleMetricsOrNull = null;
    let compra: IPurshaceMetricsOrNull = null;

    if (
      transacciones.some(
        (transaccion) => transaccion.tipoTransaccion === TypeTransaction.VENTA
      )
    ) {
      // Ventas
      let productoMasVendido = await this.getProductoMasTransaccionado(
        productWithTransactions,
        branchInventoryList,
        TypeTransaction.VENTA
      );
      let productos = await this.getProductosPorTransaccion(
        productWithTransactions,
        branchInventoryList,
        TypeTransaction.VENTA
      );
      let productoConMasTotalVenidioDelDia =
        await this.getProductoConMasTotalTransaccionado(
          productWithTransactions,
          branchInventoryList,
          TypeTransaction.VENTA
        );
      let productoConMasGananciaNetaDelDia =
        await this.getProductoConMasGananciaNetaDelDia(
          productWithTransactions,
          branchInventoryList,
          TypeTransaction.VENTA
        );

      venta = {
        productoMayorCantidad: productoMasVendido,
        productoMayorTotal: productoConMasTotalVenidioDelDia,
        productoMayorGanancia: productoConMasGananciaNetaDelDia,
        listaProductos: productos,
      };
    }

    if (
      transacciones.some(
        (transaccion) => transaccion.tipoTransaccion === TypeTransaction.COMPRA
      )
    ) {
      let productoMasComprado = await this.getProductoMasTransaccionado(
        productWithTransactions,
        branchInventoryList,
        TypeTransaction.COMPRA
      );
      let productosComprados = await this.getProductosPorTransaccion(
        productWithTransactions,
        branchInventoryList,
        TypeTransaction.COMPRA
      );
      let productoConMasTotalComprado =
        await this.getProductoConMasTotalTransaccionado(
          productWithTransactions,
          branchInventoryList,
          TypeTransaction.COMPRA
        );
      let productoRentableComprado =
        await this.getProductoConMasGananciaNetaDelDia(
          productWithTransactions,
          branchInventoryList,
          TypeTransaction.COMPRA
        );

      compra = {
        productoMayorCantidad: productoMasComprado,
        productoMayorTotal: productoConMasTotalComprado,
        productoMayorGanancia: productoRentableComprado,
        listaProductos: productosComprados,
      };
    }

    let response = {
      venta,
      compra,
    };

    return response;
  }

  async getProductoMasTransaccionado(
    productosVendidos,
    listInventarioSucursal: IInventarioSucursal[],
    tipoTransaccion: TypeTransaction
  ): Promise<IProductoMasVendido> {
    let productoMasVendido = '';
    let maxCantidad = 0;
    let maxTotal = cero128;
    let maxGananciaNeta = cero128;
    let maxCostoUnitario = cero128;

    for (const productoId in productosVendidos) {
      let [id, tipoTransaccionPro] = productoId.split('_');
      let condition = tipoTransaccionPro !== tipoTransaccion;

      let key = `${id}_${tipoTransaccion}`;

      if (condition) continue;

      if (productosVendidos[key].cantidad > maxCantidad) {
        maxCantidad = productosVendidos[key].cantidad;
        maxTotal = productosVendidos[key].total;
        productoMasVendido = key;
        maxGananciaNeta = productosVendidos[key].gananciaNeta;
        maxCostoUnitario = productosVendidos[key].costoUnitario;
      }
    }

    const producto = listInventarioSucursal.find(
      (item) => item.productoId.toString() === productoMasVendido.split('_')[0]
    ) as IInventarioSucursal;

    return {
      //@ts-ignore
      producto: producto.producto.nombre,
      cantidad: maxCantidad,
      total: maxTotal,
      gananciaNeta: maxGananciaNeta,
      costoUnitario: maxCostoUnitario,
    };
  }

  async getProductoConMasTotalTransaccionado(
    productosVendidos,
    branchInventoryList: IInventarioSucursal[],
    tipoTransaccion: TypeTransaction
  ): Promise<IProductoConMasTotalVendidoDelDia> {
    let productoMasVendido = '';
    let maxCantidad = 0;
    let maxTotal = cero128;
    let maxGananciaNeta = cero128;
    let maxCostoUnitario = cero128;

    for (const productoId in productosVendidos) {
      let [id, tipoTransaccionPro] = productoId.split('_');
      let condition = tipoTransaccionPro !== tipoTransaccion;

      let key = `${id}_${tipoTransaccion}`;

      if (condition) continue;

      //@ts-ignore
      if (compareDecimal128(productosVendidos[key].total, maxTotal)) {
        maxCantidad = productosVendidos[key].cantidad;
        maxTotal = productosVendidos[key].total;
        productoMasVendido = key;
        maxGananciaNeta = productosVendidos[key].gananciaNeta;
        maxCostoUnitario = productosVendidos[key].costoUnitario;
      }
    }

    const producto = branchInventoryList.find(
      (item) => item.productoId.toString() === productoMasVendido.split('_')[0]
    ) as IInventarioSucursal;

    return {
      //@ts-ignore
      producto: producto.producto.nombre,
      cantidad: maxCantidad,
      total: maxTotal,
      gananciaNeta: maxGananciaNeta,
      costoUnitario: maxCostoUnitario,
    };
  }

  async getProductoConMasGananciaNetaDelDia(
    productosVendidos,
    branchInventoryList: IInventarioSucursal[],
    tipoTransaccion: TypeTransaction
  ): Promise<IProductoConMasGananciaNetaDelDia> {
    let productoMasVendido = '';
    let maxCantidad = 0;
    let maxTotal = cero128;
    let maxGananciaNeta = cero128;
    let maxCostoUnitario = cero128;

    for (const productoId in productosVendidos) {
      let [id, tipoTransaccionPro] = productoId.split('_');
      let condition = tipoTransaccionPro !== tipoTransaccion;

      let key = `${id}_${tipoTransaccion}`;

      if (condition) continue;

      if (
        compareDecimal128(productosVendidos[key].gananciaNeta, maxGananciaNeta)
      ) {
        maxCantidad = productosVendidos[key].cantidad;
        maxTotal = productosVendidos[key].total;
        productoMasVendido = key;
        maxGananciaNeta = productosVendidos[key].gananciaNeta;
        maxCostoUnitario = productosVendidos[key].costoUnitario;
      }
    }

    const producto = branchInventoryList.find(
      (item) => item.productoId.toString() === productoMasVendido.split('_')[0]
    ) as IInventarioSucursal;

    return {
      //@ts-ignore
      producto: producto.producto.nombre,
      cantidad: maxCantidad,
      total: maxTotal,
      gananciaNeta: maxGananciaNeta,
      costoUnitario: maxCostoUnitario,
    };
  }

  async getProductosPorTransaccion(
    productosVendidos,
    branchInventoryList: IInventarioSucursal[],
    tipoTransaccion: TypeTransaction
  ): Promise<IProductosMetrics[]> {
    //@ts-ignore
    return branchInventoryList
      .map((producto) => {
        let productoId = (producto.productoId as Types.ObjectId).toString();

        let key = `${productoId}_${tipoTransaccion}`;
        return productosVendidos[key]
          ? {
              //@ts-ignore
              nombre: producto.producto.nombre,
              cantidad: productosVendidos[key].cantidad,
              total: productosVendidos[key].total,
              gananciaNeta: productosVendidos[key].gananciaNeta,
              costoUnitario: productosVendidos[key].costoUnitario,
            }
          : null;
      })
      .filter((item) => item !== null);
  }

  async findReturnTransactionByBranchId(
    branchId: string,
    fechaInicioStr: string,
    fechaFinStr: string
  ) {
    let fechaInicio = isValidDateWithFormat(fechaInicioStr, 'dd-MM-yyyy');
    let fechaFin = isValidDateWithFormat(fechaFinStr, 'dd-MM-yyyy');

    if (!fechaInicio || !fechaFin) throw new Error('Fecha no valida');

    let returns =
      await this.transactionRepository.findReturnTransactionByBranchId(
        branchId,
        fechaInicio.toJSDate(),
        fechaFin.toJSDate()
      );

    if (returns.length === 0)
      throw new Error('No hay devoluciones para este periodo');

    let listProductoIdIdsSets = new Set<any>();

    returns.forEach((transaccion) => {
      transaccion.transactionDetails.forEach((detalle) => {
        listProductoIdIdsSets.add(detalle.productoId.toString()); // Agregar a Set
      });
    });

    // Si necesitas un array al final:
    const listProductoIdIds = Array.from(listProductoIdIdsSets);

    const branchInventoryList =
      await this.inventarioSucursalRepository.getListProductByProductIdsMetricas(
        branchId,
        listProductoIdIds
      );

    const productWithTransactions = {};
    let quantityReturnedProducts = 0;
    let amountReturned = cero128;

    //
    returns.forEach((singleReturn) => {
      singleReturn.transactionDetails.forEach((detalle) => {
        let detalleCantidad128 = new Types.Decimal128(
          detalle.cantidad.toString()
        );
        let inventarioSucursal = branchInventoryList.find(
          (item) => item.productoId.toString() === detalle.productoId.toString()
        ) as IInventarioSucursal;
        let costoUnitario = multiplicarDecimal128(
          inventarioSucursal.costoUnitario,
          detalleCantidad128
        );
        let total128 = new Types.Decimal128(detalle.total.toString());

        let key = `${detalle.productoId}_${singleReturn.tipoTransaccion}`;

        if (productWithTransactions[key]) {
          productWithTransactions[key].cantidad += detalle.cantidad;
          quantityReturnedProducts += detalle.cantidad;
          productWithTransactions[key].total = sumarDecimal128(
            productWithTransactions[key].total,
            detalle.total
          );
          amountReturned = sumarDecimal128(amountReturned, detalle.total);
          productWithTransactions[key].costoUnitario = sumarDecimal128(
            productWithTransactions[key].costoUnitario,
            costoUnitario
          );
          productWithTransactions[key].gananciaNeta = sumarDecimal128(
            productWithTransactions[key].gananciaNeta,
            restarDecimal128(total128, costoUnitario)
          );
        } else {
          amountReturned = sumarDecimal128(amountReturned, detalle.total);
          quantityReturnedProducts += detalle.cantidad;
          productWithTransactions[key] = {
            cantidad: detalle.cantidad,
            total: detalle.total,
            costoUnitario: costoUnitario,
            gananciaNeta: restarDecimal128(total128, costoUnitario),
          };
        }
      });
    });

    return {
      amountReturned: amountReturned,
      quantityReturned: quantityReturnedProducts,
      listProducts: productWithTransactions,
    };
  }
}
