import mongoose, { mongo, Types } from "mongoose";
import { ITransaccionCreate, ITrasaccionProducto, TypeTransaction } from "../models/transaction/Transaction.model";

export interface IOpenCash {
  usuarioAperturaId: string;
  montoInicial: number;
  cajaId:string;
  userId: string;
}

export interface ICloseCash {
  cajaId: string;
  montoFinalDeclarado: string;
  usuarioArqueoId: string;
  closeWithoutCounting: boolean;
  motivoCierre?: string;
}

export interface ICreataCashRegister {
  sucursalId: string;
  usuarioAperturaId: string;
  montoInicial: number;
  consecutivo?: number;
}

export type IOpenCashService = Omit<IOpenCash, 'session'>;

export type ITypeCashRegisterMovement =  'VENTA' | 'INGRESO' | 'EGRESO' | 'COMPRA' | 'APERTURA' | 'DEVOLUCION';

export enum TypeEstatusTransaction {
  PENDIENTE = 'PENDIENTE',
  PARCIALMENTE = 'PARCIALMENTE PAGADA',
  ENMORA = 'EN MORA',
  PAGADA = 'PAGADA',
  CANCELADA = 'CANCELADA',
  DEVOLUCION = 'DEVOLUCION',  
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
  id: mongoose.Types.ObjectId | null;
  esDineroExterno: boolean;
  montoExterno?: mongoose.Types.Decimal128 | null;
}

export interface IActualizarMontoEsperado {
  cajaId: string;
  monto: Types.Decimal128;
  aumentar?:boolean;
}

export interface IActualizarMontoEsperadoByVenta {
  data: ITransactionCreateCaja;
}