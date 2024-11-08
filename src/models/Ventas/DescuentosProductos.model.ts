import mongoose, { Schema, Document } from 'mongoose';
import { Descuento, IDescuento } from './Descuento.model';
import { IProducto, Producto } from '../inventario/Producto.model';
import { ISucursal, Sucursal } from '../sucursales/Sucursal.model';

export interface IDescuentosProductos extends Document {
  descuentoId: mongoose.Types.ObjectId | IDescuento;
  productId: mongoose.Types.ObjectId | IProducto;
  sucursalId?: mongoose.Types.ObjectId | ISucursal;
  deleted_at: Date | null;
}

const descuentosProductosSchema: Schema = new Schema(
  {
    descuentoId: {
      type: Schema.Types.ObjectId,
      ref: Descuento,
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: Producto,
      required: true,
    },
    sucursalId: {
      type: Schema.Types.ObjectId,
      ref: Sucursal,
    },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: true }
);

export const DescuentosProductos = mongoose.model<IDescuentosProductos>(
  'DescuentosProductos',
  descuentosProductosSchema
);
