import mongoose, { Schema, Document } from 'mongoose';
import { IProducto } from './Producto.model';
import { ISucursal } from '../sucursales/Sucursal.model';

export interface IInventarioSucursal extends Document {
  productoId: mongoose.Types.ObjectId | IProducto;
  sucursalId: mongoose.Types.ObjectId | ISucursal;
  stock: number;
  precio:mongoose.Types.Decimal128;
  ultimo_movimiento: Date;
  deleted_at: Date | null;
  puntoReCompra: number;
  costoUnitario: mongoose.Types.Decimal128;
}

export interface IInventarioSucursalUpdate extends Omit<IInventarioSucursal, 'deleted_at' | 'productoId' | 'sucursalId' | 'ultimo_movimiento'> {
  nombre?: string;
  descripcion?: string;
  barCode?: string;
}

const inventarioSucursalSchema: Schema = new Schema(
  {
    productoId: {
      type: Schema.Types.ObjectId,
      ref: 'Producto',
      required: true,
    },
    sucursalId: {
      type: Schema.Types.ObjectId,
      ref: 'Sucursal',
      required: true,
    },
    stock: { type: Number, required: true },
    precio: { type: Schema.Types.Decimal128, required: true },
    costoUnitario: { type: Schema.Types.Decimal128, required: true },
    ultimo_movimiento: { type: Date, required: true },
    puntoReCompra: { type: Number, required: true },
    deleted_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'update_at' },
  }
);

inventarioSucursalSchema.index({ productoId: 1, sucursalId: 1 });
inventarioSucursalSchema.index({ stock: 1 });

export const InventarioSucursal = mongoose.model<IInventarioSucursal>(
  'InventarioSucursal',
  inventarioSucursalSchema
);
