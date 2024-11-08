import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from '../usuarios/User.model';
import { ISucursal } from '../sucursales/Sucursal.model';

export interface IVenta extends Document {
  usuarioId: mongoose.Types.ObjectId | IUser;
  sucursalId: mongoose.Types.ObjectId | ISucursal;
  subtotal: mongoose.Types.Decimal128;
  total: mongoose.Types.Decimal128;
  descuento: mongoose.Types.Decimal128;
  fechaRegistro: Date;
  deleted_at: Date | null;
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
}

const ventaSchema: Schema = new Schema(
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
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'update_at' },
  }
);

export const Venta = mongoose.model<IVenta>('Venta', ventaSchema);
