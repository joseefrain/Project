import mongoose, { mongo, Types } from "mongoose";
import { ITransaccionCreate, ITrasaccionProducto, TypeTransaction } from "../models/transaction/Transaction.model";

export interface IOpenCash {
  usuarioAperturaId: string;
  montoInicial: number;
  cajaId:string;
}

export interface ICloseCash {
  cajaId: string;
  montoFinalDeclarado: string;
  usuarioArqueoId: string;
  closeWithoutCounting: boolean;
}

export interface ICreataCashRegister {
  sucursalId: string;
  usuarioAperturaId: string;
  montoInicial: number;
  consecutivo?: number;
}

export type IOpenCashService = Omit<IOpenCash, 'session'>;

export type ITypeCashRegisterMovement =  'VENTA' | 'INGRESO' | 'EGRESO' | 'COMPRA' | 'APERTURA';
export type TypeEstatusTransaction = 'PENDIENTE' | 'PARCIALMENTE PAGADA' | 'EN MORA' | 'PAGADA' | 'CANCELADA';

export interface ITypeEstatusSales {
  PENDIENE: TypeEstatusTransaction,
  PARCIALMENTE: TypeEstatusTransaction,
  ENMORA: TypeEstatusTransaction,
  PAGADA: TypeEstatusTransaction,
  CANCELADA: TypeEstatusTransaction,
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
  sucursalId: string,
  cajaId: string
}

export interface IAddExpenseDailySummary {
  expense: number;
  sucursalId: string;
  cajaId: string;
}

export interface ITransactionCreateCaja {
  cajaId?:string;
  total: number;
  monto?:number;
  cambioCliente?:number;
  tipoTransaccion: TypeTransaction;
  userId: string;
}

export interface IActualizarMontoEsperado {
  cajaId: string;
  monto: Types.Decimal128;
  aumentar?:boolean;
}

export interface IActualizarMontoEsperadoByVenta {
  data: ITransactionCreateCaja;
}