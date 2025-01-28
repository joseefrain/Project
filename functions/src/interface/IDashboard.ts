import { Types } from "mongoose";

export interface IProductoMasVendido {
  producto: string;
  cantidad: number;
  total: Types.Decimal128;
  gananciaNeta: Types.Decimal128;
  costoUnitario: Types.Decimal128;
}

export interface productoConMasTotalVendidoDelDia {
  producto: string;
  cantidad: number;
  total: Types.Decimal128;
  gananciaNeta: Types.Decimal128;
  costoUnitario: Types.Decimal128;
}

export interface productoConMasGananciaNetaDelDia {
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
}[]

export interface IResponseGetProductMetrics {
  productoMasVendido: IProductoMasVendido;
  productoConMasTotalVenidioDelDia: productoConMasTotalVendidoDelDia;
  productoConMasGananciaNetaDelDia: productoConMasGananciaNetaDelDia;
  productos: IProductosMetrics;
}