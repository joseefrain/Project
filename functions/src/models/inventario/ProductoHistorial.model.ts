import mongoose, { Schema, Document } from 'mongoose';
import { IProducto } from './Producto.model';
import { IUser } from '../usuarios/User.model';

export interface IProductoHistorial extends Document {
  productoId: mongoose.Types.ObjectId | IProducto;
  precio: number;
  fechaActualizacion: Date;
  usuarioId: mongoose.Types.ObjectId | IUser;
  deleted_at: Date | null;
}

const productoHistorialSchema: Schema = new Schema(
  {
    productoId: {
      type: Schema.Types.ObjectId,
      ref: 'Producto',
      required: true,
    },
    precio: { type: Number, required: true },
    fechaActualizacion: { type: Date, required: true },
    usuarioId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deleted_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'update_at' },
  }
);

export const ProductoHistorial = mongoose.model<IProductoHistorial>(
  'ProductoHistorial',
  productoHistorialSchema
);
