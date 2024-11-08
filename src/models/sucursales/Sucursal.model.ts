import mongoose, { Schema, Document } from 'mongoose';
import { IProducto } from '../inventario/Producto.model';

export interface ISucursal extends Document {
  nombre: string;
  direccion: string;
  ciudad: string;
  pais: string;
  telefono: string;
  deleted_at: Date | null;
}

const sucursalSchema: Schema = new Schema(
  {
    nombre: { type: String, required: true },
    direccion: { type: String, required: true },
    ciudad: { type: String, required: true },
    pais: { type: String, required: true },
    telefono: { type: String, required: true },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Sucursal = mongoose.model<ISucursal>('Sucursal', sucursalSchema);
