import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from '../usuarios/User.model';
import { IInventarioSucursal } from './InventarioSucursal.model';

export interface IProductoHistorial extends Document {
  inventarioSucursalId: mongoose.Types.ObjectId | IInventarioSucursal;
  costoUnitario: mongoose.Types.Decimal128;
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
    costoUnitario: { type: Schema.Types.Decimal128, required: true },
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
