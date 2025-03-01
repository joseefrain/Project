import mongoose, { Schema, Document } from 'mongoose';
import { ITransaccion } from './Venta.model';
import { IProducto } from '../inventario/Producto.model';
import { ITipoDescuentoEntidad } from './Descuento.model';

export interface IDetalleVenta extends Document {
  ventaId: mongoose.Types.ObjectId | ITransaccion;
  productoId: mongoose.Types.ObjectId | IProducto;
  precio: mongoose.Types.Decimal128;
  cantidad: number;
  subtotal: mongoose.Types.Decimal128;
  total: mongoose.Types.Decimal128;
  tipoCliente: 'Regular' | 'Proveedor';
  descuento: mongoose.Types.Decimal128;
  deleted_at: Date | null;
  tipoDescuentoEntidad: ITipoDescuentoEntidad,
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
    tipoDescuentoEntidad: { type: String, enum: ['Product', 'Group'], required: true },
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
