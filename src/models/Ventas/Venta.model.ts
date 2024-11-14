import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from '../usuarios/User.model';
import { ISucursal } from '../sucursales/Sucursal.model';
import { TypeEstatusTransaction } from '../../interface/ICaja';

export interface ITrasaccion extends Document {
  usuarioId: mongoose.Types.ObjectId | IUser;
  sucursalId: mongoose.Types.ObjectId | ISucursal;
  subtotal: mongoose.Types.Decimal128;
  total: mongoose.Types.Decimal128;
  descuento: mongoose.Types.Decimal128;
  fechaRegistro: Date;
  deleted_at: Date | null;
  estadoTrasaccion: TypeEstatusTransaction;  
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
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'update_at' },
  }
);

export const Trasaccion = mongoose.model<ITrasaccion>('Venta', transaccionSchema);
