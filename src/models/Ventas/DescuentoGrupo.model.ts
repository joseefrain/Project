import mongoose, { Schema, Document } from 'mongoose';
import { Descuento, IDescuento } from './Descuento.model';
import { GrupoInventario, IGrupoInventario } from '../inventario/GrupoInventario.model';
import { ISucursal, Sucursal } from '../sucursales/Sucursal.model';

export interface IDescuentoGrupo extends Document {
  descuentoId: mongoose.Types.ObjectId | IDescuento;
  grupoId: mongoose.Types.ObjectId | IGrupoInventario;
  sucursalId?: mongoose.Types.ObjectId | ISucursal;
  deleted_at: Date | null;
}

const descuentoGrupoSchema: Schema = new Schema(
  {
    descuentoId: {
      type: Schema.Types.ObjectId,
      ref: Descuento,
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
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'update_at' },
  }
);

export const DescuentoGrupo = mongoose.model<IDescuentoGrupo>(
  'DescuentoGrupo',
  descuentoGrupoSchema
);
