import mongoose, { mongo, Types } from "mongoose";
import { IVentaCreate, IVentaProducto } from "../models/Ventas/Venta.model";

export interface IOpenCash {
  sucursalId: string;
  usuarioAperturaId: string;
  montoInicial: number;
  session: mongoose.mongo.ClientSession
}

export type IOpenCashService = Omit<IOpenCash, 'session'>;

export type ITypeCashRegisterMovement =  'VENTA' | 'INGRESO' | 'EGRESO' | 'COMPRA' | 'APERTURA';
export type TypeEstatusSales = 'PENDIENTE' | 'PARCIALMENTE PAGADA' | 'EN MORA' | 'PAGADA' | 'CANCELADA';

export interface ITypeEstatusSales {
  PENDIENE: TypeEstatusSales,
  PARCIALMENTE: TypeEstatusSales,
  ENMORA: TypeEstatusSales,
  PAGADA: TypeEstatusSales,
  CANCELADA: TypeEstatusSales,
}

export const tipoEstatusSales:ITypeEstatusSales = {
  PENDIENE: 'PENDIENTE',
  PARCIALMENTE: 'PARCIALMENTE PAGADA',
  ENMORA: 'EN MORA',
  PAGADA: 'PAGADA',
  CANCELADA: 'CANCELADA',
}

export interface ICashRegisterMovementObejct {
  VENTA: ITypeCashRegisterMovement;
  INGRESO: ITypeCashRegisterMovement;
  EGRESO: ITypeCashRegisterMovement;
  COMPRA: ITypeCashRegisterMovement;
  APERTURA: ITypeCashRegisterMovement;
}

export const tipeCashRegisterMovement:ICashRegisterMovementObejct = {
  VENTA: 'VENTA',
  INGRESO: 'INGRESO',
  EGRESO: 'EGRESO',
  COMPRA: 'COMPRA',
  APERTURA: 'APERTURA',
}

export interface IAddIncomeDailySummary {
  ingreso: number,
  session: mongoose.mongo.ClientSession,
  sucursalId: string,
  cajaId: string
}

export interface IAddExpenseDailySummary {
  expense: number;
  session: mongoose.ClientSession;
  sucursalId: string;
  cajaId: string;
}

export interface IVentaCreateCaja {
  id: string;
  userId: string;
  sucursalId: string;
  products: IVentaProducto[];
  subtotal: number;
  total: number;
  discount: number;
  fechaRegistro?: Date;
  monto?:number;
  cambioCliente?:number;
  cajaId?:string;
}

export interface IActualizarMontoEsperado {
  cajaId: string;
  monto: Types.Decimal128;
  session: mongoose.mongo.ClientSession;
  aumentar?:boolean;
}

export interface IActualizarMontoEsperadoByVenta {
  cajaId: string;
  data: IVentaCreateCaja;
  session: mongo.ClientSession
}