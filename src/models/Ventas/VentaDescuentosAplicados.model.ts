import mongoose, { Schema, Document } from "mongoose";
import { DescuentosProductos, IDescuentosProductos } from "./DescuentosProductos.model";
import { DescuentoGrupo, IDescuentoGrupo } from "./DescuentoGrupo.model";
import { ITipoDescuentoEntidad } from "./Descuento.model";

export type ITipoDescuento = 'PORCENTAJE' | 'FIJO';

export interface IVentaDescuentosAplicados extends Document {
  detalleVentaId: mongoose.Types.ObjectId;
  descuentosProductosId?: mongoose.Types.ObjectId | IDescuentosProductos;
  descuentoGrupoId?: mongoose.Types.ObjectId | IDescuentoGrupo;
  tipoAplicacion: ITipoDescuentoEntidad;
  valor: mongoose.Types.Decimal128;
  tipo: ITipoDescuento;
  monto: mongoose.Types.Decimal128;
}

const ventaDescuentosAplicadosSchema = new Schema<IVentaDescuentosAplicados>({
  detalleVentaId: {
    type: Schema.Types.ObjectId,
    ref: 'DetalleVenta',
    required: true
  },
  descuentosProductosId: {
    type: Schema.Types.ObjectId,
    ref: DescuentosProductos,
    default: null
  },
  descuentoGrupoId: {
    type: Schema.Types.ObjectId,
    ref: DescuentoGrupo,
    default: null
  },
  tipoAplicacion: {
    type: String,
    enum: ['Product', 'Group'],
    required: true
  },
  valor: {
    type: mongoose.Types.Decimal128,
    required: true
  },
  tipo: {
    type: String,
    enum: ['PORCENTAJE', 'FIJO'],
    required: true
  },
  monto: {
    type: mongoose.Types.Decimal128,
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updatedAt' } // Corregido a `updatedAt`
});

export const VentaDescuentosAplicados = mongoose.model<IVentaDescuentosAplicados>(
  'VentaDescuentosAplicados',
  ventaDescuentosAplicadosSchema
);
