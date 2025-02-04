import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from '../usuarios/User.model';
import { ISucursal } from '../sucursales/Sucursal.model';
import { TypeEstatusTransaction } from '../../interface/ICaja';
import Caja, { ICaja } from "../cashRegister/CashRegister.model"
import { IEntity } from '../entity/Entity.model';
import { ModalidadCredito } from '../credito/Credito.model';
import { IDetalleTransaccion } from './DetailTransaction.model';
import { IDescountTypePV } from './Descuento.model';

export enum TypeTransaction {
  VENTA = 'VENTA',
  COMPRA = 'COMPRA',
  INGRESO = 'INGRESO',
  EGRESO = 'EGRESO',
  APERTURA = 'APERTURA',
  DEVOLUCION = 'DEVOLUCION',
};
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
  totalAjusteACobrar:Types.Decimal128;
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

export interface IDescuentoAplicado {
  id: string;
  name: string;
  type: 'producto' | 'grupo';
  amount: number;
  percentage: number;
  productId: string | null;
  groupId: string | null;
  sucursalId: string | null;
  fechaInicio: Date;
  fechaFin: Date;
  minimoCompra?: Types.Decimal128;
  minimoCantidad?: number;
  activo:boolean,
  minimiType:IDescountTypePV
  tipoDescuento: string;
}

export interface ITrasaccionProductoResponse {
  ventaId: string;
  productId: string;
  groupId: string;
  clientType: 'Regular' | 'Proveedor';
  productName: string;
  quantity: number;
  price: number;
  costoUnitario?: number;
  inventarioSucursalId: string;
  discount: null | IDescuentoAplicado;
  ajusteACobrar: Types.Decimal128
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
  id?: string;
}

export interface ITransaccionResponse {
  userId: string;
  sucursalId: string;
  products: ITrasaccionProductoResponse[];
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
  id?: string;
  totalAjusteACobrar:Types.Decimal128;
  tipoTransaccionOrigen: TypeTransaction | null;
  username: string;
}

export interface ITransaccionNoDto {
  transaccion: ITransaccion;
  datalleTransaccion: IDetalleTransaccion[];
}

// Devoluciones interface

export interface IDevolucionesProducto {
  quantity: number;
  productId: string;
  discountApplied: boolean;
}

export interface IDevolucionesCreate {
  userId: string;
  products: IDevolucionesProducto[];
  monto:number
  cajaId:string;
  trasaccionOrigenId: string;
  esDineroExterno:boolean
  montoExterno?: number | null;
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
      enum: ['PENDIENTE', 'PARCIALMENTE PAGADA', 'EN MORA', 'PAGADA', 'CANCELADA', 'DEVOLUCION'],
      required: true,
      default: 'PENDIENTE',
    },
    tipoTransaccion: {
      type: String,
      enum: ['VENTA', 'COMPRA', 'INGRESO', 'EGRESO', 'APERTURA', 'DEVOLUCION'],
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
    totalAjusteACobrar: { type: Schema.Types.Decimal128, default: 0 },
    transaccionOrigenId: { type: Schema.Types.ObjectId, default: null },
    motivoDevolucion: { type: String, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'update_at' },
  }
);

// indices 
transaccionSchema.index({ sucursalId: 1, fechaRegistro: -1 });
transaccionSchema.index({ estadoTrasaccion: 1 });

export const Transaccion = mongoose.model<ITransaccion>('Transaccion', transaccionSchema);
