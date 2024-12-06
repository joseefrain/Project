import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from '../usuarios/User.model';
import { ISucursal } from '../sucursales/Sucursal.model';
import { TypeEstatusTransaction } from '../../interface/ICaja';
import { IEntity } from '../entity/Entity.model';
import { ModalidadCredito } from '../credito/Credito.model';

export type TypeTransaction = 'VENTA' | 'COMPRA' | 'INGRESO' | 'EGRESO' | 'APERTURA';
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
}

export interface IVentaProducto {
  ventaId: string;
  productId: string;
  groupId: string;
  clientType: 'Regular' | 'Proveedor';
  productName: string;
  quantity: number;
  price: number;
  inventarioSucursalId: string;
  discount: null | IVentaDescuento;
}

export interface IVentaDescuento {
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
export interface IVentaCreate {
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
  entidadId?: string; // nuevo
  paymentMethod: TypePaymentMethod; // nuevo
  credito?: ICreditoCreate; // nuevo
  tipoTransaccion: TypeTransaction;
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
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'update_at' },
  }
);

export const Transaccion = mongoose.model<ITransaccion>('Venta', transaccionSchema);
