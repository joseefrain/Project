import mongoose, { Schema, Document } from 'mongoose';
import { IProducto, Producto } from './Producto.model';
import { GrupoInventario, IGrupoInventario } from './GrupoInventario.model';
import { ISucursal, Sucursal } from '../sucursales/Sucursal.model';

export interface IProductosGrupos extends Document {
  productoId: mongoose.Types.ObjectId | IProducto;
  grupoId: mongoose.Types.ObjectId | IGrupoInventario;
  sucursalId?: mongoose.Types.ObjectId | ISucursal;
  deleted_at: Date | null;
}

const productosGruposSchema: Schema = new Schema(
  {
    productoId: {
      type: Schema.Types.ObjectId,
      ref: Producto,
      required: true,
    },
    grupoId: {
      type: Schema.Types.ObjectId,
      ref: GrupoInventario,
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

export const ProductosGrupos = mongoose.model<IProductosGrupos>(
  'ProductosGrupos',
  productosGruposSchema
);
