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
import { IProductoMasVendido, IProductosMetrics, IResponseGetProductMetrics } from '../../interface/IDashboard';

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

  async getTransactionMetrics(sucursalId):Promise<IResponseGetProductMetrics> {
    const transacciones =
      await this.transactionRepository.findPaidTransactionsDayBySucursalId(
        sucursalId
      );

    // let listInventarioSucursalIds = venta.products?.map((detalle) =>detalle.inventarioSucursalId) as string[];
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

    const productosVendidos = {};

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

        if (productosVendidos[detalle.productoId]) {
          productosVendidos[detalle.productoId].cantidad += detalle.cantidad;
          productosVendidos[detalle.productoId].total = sumarDecimal128(
            productosVendidos[detalle.productoId].total,
            detalle.total
          );
          productosVendidos[detalle.productoId].costoUnitario = sumarDecimal128(
            productosVendidos[detalle.productoId].costoUnitario,
            costoUnitario
          );
          productosVendidos[detalle.productoId].gananciaNeta = sumarDecimal128(
            productosVendidos[detalle.productoId].gananciaNeta,
            restarDecimal128(total128, costoUnitario)
          );
        } else {
          productosVendidos[detalle.productoId] = {
            cantidad: detalle.cantidad,
            total: detalle.total,
            costoUnitario: costoUnitario,
            gananciaNeta: restarDecimal128(total128, costoUnitario),
          };
        }
      });
    });

    let productoMasVendido = await this.getProductoMasVendidoDelDia(productosVendidos, branchInventoryList);
    let productos = await this.getProductosVendidos(productosVendidos, branchInventoryList);
    let productoConMasTotalVenidioDelDia = await this.getProductoConMasTotalVendidoDelDia(productosVendidos, branchInventoryList);
    let productoConMasGananciaNetaDelDia= await this.getProductoConMasGananciaNetaDelDia(productosVendidos, branchInventoryList);

    return {
      productoMasVendido: productoMasVendido,
      productoConMasTotalVenidioDelDia: productoConMasTotalVenidioDelDia,
      productoConMasGananciaNetaDelDia: productoConMasGananciaNetaDelDia,
      productos: productos,
    };
  }

  async getProductoMasVendidoDelDia(productosVendidos, listInventarioSucursal: IInventarioSucursal[]): Promise<IProductoMasVendido> {
    let productoMasVendido = '';
    let maxCantidad = 0;
    let maxTotal = cero128;
    let maxGananciaNeta = cero128;
    let maxCostoUnitario = cero128;

    for (const productoId in productosVendidos) {
      if (productosVendidos[productoId].cantidad > maxCantidad) {
        maxCantidad = productosVendidos[productoId].cantidad;
        maxTotal = productosVendidos[productoId].total;
        productoMasVendido = productoId;
        maxGananciaNeta = productosVendidos[productoId].gananciaNeta;
        maxCostoUnitario = productosVendidos[productoId].costoUnitario;
      }
    }

    const producto = listInventarioSucursal.find(
      (item) => item.productoId.toString() === productoMasVendido
    ) as IInventarioSucursal

    return {
      //@ts-ignore
      producto: producto.producto.nombre,
      cantidad: maxCantidad,
      total: maxTotal,
      gananciaNeta: maxGananciaNeta,
      costoUnitario: maxCostoUnitario,
    };
  }

  async getProductoConMasTotalVendidoDelDia(productosVendidos, branchInventoryList:IInventarioSucursal[]) {
    let productoMasVendido = '';
    let maxCantidad = 0;
    let maxTotal = cero128;
    let maxGananciaNeta =cero128;
    let maxCostoUnitario = cero128;

    for (const productoId in productosVendidos) {
      //@ts-ignore
      if (compareDecimal128(productosVendidos[productoId].total, maxTotal)) {
        maxCantidad = productosVendidos[productoId].cantidad;
        maxTotal = productosVendidos[productoId].total;
        productoMasVendido = productoId;
        maxGananciaNeta = productosVendidos[productoId].gananciaNeta;
        maxCostoUnitario = productosVendidos[productoId].costoUnitario;
      }
    }
    
    const producto = branchInventoryList.find(
      (item) => item.productoId.toString() === productoMasVendido
    ) as IInventarioSucursal

    return {
      //@ts-ignore
      producto: producto.producto.nombre,
      cantidad: maxCantidad,
      total: maxTotal,
      gananciaNeta: maxGananciaNeta,
      costoUnitario: maxCostoUnitario,
    };
  }

  async getProductoConMasGananciaNetaDelDia(productosVendidos, branchInventoryList:IInventarioSucursal[]) {
    let productoMasVendido = '';
    let maxCantidad = 0;
    let maxTotal = cero128;
    let maxGananciaNeta = cero128;
    let maxCostoUnitario = cero128;

    for (const productoId in productosVendidos) {
      //@ts-ignore
      if (compareDecimal128(productosVendidos[productoId].gananciaNeta, maxGananciaNeta)) {
        maxCantidad = productosVendidos[productoId].cantidad;
        maxTotal = productosVendidos[productoId].total;
        productoMasVendido = productoId;
        maxGananciaNeta = productosVendidos[productoId].gananciaNeta;
        maxCostoUnitario = productosVendidos[productoId].costoUnitario;
      }
    }
    
    const producto = branchInventoryList.find(
      (item) => item.productoId.toString() === productoMasVendido
    ) as IInventarioSucursal

    return {
      //@ts-ignore
      producto: producto.producto.nombre,
      cantidad: maxCantidad,
      total: maxTotal,
      gananciaNeta: maxGananciaNeta,
      costoUnitario: maxCostoUnitario,
    };
  }

  async getProductosVendidos(productosVendidos, branchInventoryList:IInventarioSucursal[]):Promise<IProductosMetrics> {
    //@ts-ignore
    return branchInventoryList.map((producto) => {
      let productoId = (producto.productoId as Types.ObjectId).toString();
      return {
        //@ts-ignore
        nombre: producto.producto.nombre,
        cantidad: productosVendidos[productoId].cantidad,
        total: productosVendidos[productoId].total,
        gananciaNeta: productosVendidos[productoId].gananciaNeta,
        costoUnitario: productosVendidos[productoId].costoUnitario,
      };
    });
  }
}
