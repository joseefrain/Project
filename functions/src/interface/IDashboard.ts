import { Types } from 'mongoose';

export interface IProductoMasVendido {
  producto: string;
  cantidad: number;
  total: Types.Decimal128;
  gananciaNeta: Types.Decimal128;
  costoUnitario: Types.Decimal128;
}

export interface IProductoConMasTotalVendidoDelDia {
  producto: string;
  cantidad: number;
  total: Types.Decimal128;
  gananciaNeta: Types.Decimal128;
  costoUnitario: Types.Decimal128;
}

export interface IProductoConMasGananciaNetaDelDia {
  producto: any;
  cantidad: number;
  total: Types.Decimal128;
  gananciaNeta: Types.Decimal128;
  costoUnitario: Types.Decimal128;
}

export interface IProductosMetrics {
  nombre: string;
  cantidad: number;
  total: Types.Decimal128;
  gananciaNeta: Types.Decimal128;
  costoUnitario: Types.Decimal128;
}
[];

export interface IResponseGetProductMetrics {
  venta: {
    productoMayorCantidad: IProductoMasVendido;
    productoMayorTotal: IProductoConMasTotalVendidoDelDia;
    productoMayorGanancia: IProductoConMasGananciaNetaDelDia;
    listaProductos: IProductosMetrics;
  };
  compra: {
    productoMayorCantidad: IProductoMasVendido;
    productoMayorTotal: IProductoConMasTotalVendidoDelDia;
    productoMayorGanancia: IProductoConMasGananciaNetaDelDia;
    listaProductos: IProductosMetrics;
  };
}
