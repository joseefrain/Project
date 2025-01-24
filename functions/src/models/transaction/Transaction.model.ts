import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from '../usuarios/User.model';
import { ISucursal } from '../sucursales/Sucursal.model';
import { TypeEstatusTransaction } from '../../interface/ICaja';
import Caja, { ICaja } from "../cashRegister/CashRegister.model"
import { IEntity } from '../entity/Entity.model';
import { ModalidadCredito } from '../credito/Credito.model';
import { IDetalleTransaccion } from './DetailTransaction.model';

export type TypeTransaction = 'VENTA' | 'COMPRA' | 'INGRESO' | 'EGRESO' | 'APERTURA' | 'DEVOLUCIÓN';
type TypePaymentMethod = 'cash' | 'credit';

export interface ITransaccion extends Document {
  usuarioId: mongoose.Types.ObjectId | IUser;
  sucursalId: mongoose.Types.ObjectId | ISucursal;
  subtotal: mongoose.Types.Decimal128;
  total: mongoose.Types.Decimal128;
  descuento: mongoose.Types.Decimal128;
  fechaRegistro: Date;
  deleted_at: Date | null;
  estadoTrasaccion: TypeEstatusTransaction;
  tipoTransaccion: TypeTransaction;
  entidadId: mongoose.Types.ObjectId | IEntity | null;
  paymentMethod: TypePaymentMethod;
  transactionDetails: mongoose.Types.ObjectId[] | IDetalleTransaccion[];
  cajaId: mongoose.Types.ObjectId | ICaja;
  transaccionOrigenId?: mongoose.Types.ObjectId | ITransaccion; // Relación con la transacción original
  motivoDevolucion?: string; 
}

export interface ITrasaccionProducto {
  ventaId: string;
  productId: string;
  groupId: string;
  clientType: 'Regular' | 'Proveedor';
  productName: string;
  quantity: number;
  price: number;
  costoUnitario?: number;
  inventarioSucursalId: string;
  discount: null | ITransaccionDescuento;
}

export interface ITransaccionDescuento {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  type:"grupo" | "producto";
} 

interface ICreditoCreate {
  modalidadCredito: ModalidadCredito;
  plazoCredito: number;
  cuotaMensual: mongoose.Types.Decimal128;
  pagoMinimoMensual: mongoose.Types.Decimal128;
}
export interface ITransaccionCreate {
  userId: string;
  sucursalId: string;
  products: ITrasaccionProducto[];
  subtotal: number;
  total: number;
  discount: number;
  fechaRegistro?: Date;
  monto?:number;
  cambioCliente?:number;
  cajaId?:string;
  entidadId?: string; // nuevo
  paymentMethod: TypePaymentMethod; // nuevo
  credito?: ICreditoCreate; // nuevo
  tipoTransaccion: TypeTransaction;
}

// Devoluciones interface

export interface IDevolucionesProducto {
  quantity: number;
  productId: string;
}

export interface IDevolucionesCreate {
  userId: string;
  sucursalId: string;
  products: IDevolucionesProducto[];
  monto:number
  cajaId:string;
  trasaccionOrigenId: string;
  esDineroExterno:boolean
  montoExterno?: number | null;
  entidadId?: string; 
  esTodaLaVenta:boolean
}

const transaccionSchema: Schema = new Schema(
  {
    usuarioId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sucursalId: {
      type: Schema.Types.ObjectId,
      ref: 'Sucursal',
      required: true,
    },
    subtotal: { type: Schema.Types.Decimal128, required: true },
    fechaRegistro: { type: Date, required: true },
    total: { type: Schema.Types.Decimal128, required: true },
    descuento: { type: Schema.Types.Decimal128, default: 0 },
    deleted_at: { type: Date, default: null },
    estadoVenta: {
      type: String,
      enum: ['PENDIENTE', 'PARCIALMENTE PAGADA', 'EN MORA', 'PAGADA', 'CANCELADA'],
      required: true,
      default: 'PENDIENTE',
    },
    estadoTrasaccion: {
      type: String,
      enum: ['PENDIENTE', 'PARCIALMENTE PAGADA', 'EN MORA', 'PAGADA', 'CANCELADA'],
      required: true,
      default: 'PENDIENTE',
    },
    tipoTransaccion: {
      type: String,
      enum: ['VENTA', 'COMPRA', 'INGRESO', 'EGRESO', 'APERTURA'],
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'credit'],
      required: true,
    },
    entidadId: {
      type: Schema.Types.ObjectId,
      ref: 'Entity',
      required: true,
    },
    transactionDetails: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: 'DetalleTransaccion',
        },
      ],
      required: true,
    },
    cajaId: {
      type: Schema.Types.ObjectId,
      ref: Caja,
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'update_at' },
  }
);

export const Transaccion = mongoose.model<ITransaccion>('Transaccion', transaccionSchema);
