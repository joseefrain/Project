import mongoose, { Schema, Document } from 'mongoose';
import { IVenta } from './Venta.model';
import { IProducto } from '../inventario/Producto.model';

export interface IDetalleVenta extends Document {
  ventaId: mongoose.Types.ObjectId | IVenta;
  productoId: mongoose.Types.ObjectId | IProducto;
  precio: mongoose.Types.Decimal128;
  cantidad: number;
  subtotal: mongoose.Types.Decimal128;
  total: mongoose.Types.Decimal128;
  tipoCliente: 'Regular' | 'Proveedor';
  descuento: mongoose.Types.Decimal128;
  deleted_at: Date | null;
}

const detalleVentaSchema: Schema = new Schema(
  {
    ventaId: { type: Schema.Types.ObjectId, ref: 'Venta', required: true },
    productoId: {
      type: Schema.Types.ObjectId,
      ref: 'Producto',
      required: true,
    },
    tipoCliente: {
      type: String,
      enum: ['Regular', 'Proveedor'],
      required: true,
    },
    precio: { type: Schema.Types.Decimal128, required: true },
    cantidad: { type: Number, required: true },
    subtotal: { type: Schema.Types.Decimal128, required: true },
    total: { type: Schema.Types.Decimal128, required: true },
    descuento: { type: Schema.Types.Decimal128, default: 0 },
    deleted_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'update_at' },
  }
);

export const DetalleVenta = mongoose.model<IDetalleVenta>(
  'DetalleVenta',
  detalleVentaSchema
);
