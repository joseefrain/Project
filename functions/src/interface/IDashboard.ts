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

interface IPurshaceMetrics {
  productoMayorCantidad: IProductoMasVendido;
  productoMayorTotal: IProductoConMasTotalVendidoDelDia;
  productoMayorGanancia: IProductoConMasGananciaNetaDelDia;
  listaProductos: IProductosMetrics[];
}

interface ISaleMetrics {
  productoMayorCantidad: IProductoMasVendido;
  productoMayorTotal: IProductoConMasTotalVendidoDelDia;
  productoMayorGanancia: IProductoConMasGananciaNetaDelDia;
  listaProductos: IProductosMetrics[];
}

export type IPurshaceMetricsOrNull = IPurshaceMetrics | null;
export type ISaleMetricsOrNull = ISaleMetrics | null;

export interface IResponseGetProductMetrics {
  venta: ISaleMetricsOrNull;
  compra: IPurshaceMetricsOrNull
}
