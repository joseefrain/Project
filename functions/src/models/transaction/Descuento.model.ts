import mongoose, { Schema, Document, Types } from 'mongoose';
import { IMoneda } from '../moneda/Moneda.model';
import { IDescuentosProductos } from './DescuentosProductos.model';
import { IDescuentoGrupo } from './DescuentoGrupo.model';

export type ITipoDescuentoEntidad = 'Product' | 'Group';
export type IDescountTypePV = 'cantidad' | 'compra';


export interface IDescuento extends Document {
  nombre: string;
  tipoDescuento: 'porcentaje' | 'valor';
  valorDescuento: number;
  fechaInicio: Date;
  fechaFin: Date;
  minimoCompra?: Types.Decimal128;
  minimoCantidad?: number;
  activo: boolean;
  moneda_id: mongoose.Types.ObjectId | IMoneda;
  codigoDescunto: string
  deleted_at: Date | null;
  minimiType: IDescountTypePV;
}

export interface IDescuentoCreateResponse extends IDescuento {
  tipoDescuentoEntidad: ITipoDescuentoEntidad
  productId?: mongoose.Types.ObjectId;
  groupId?: mongoose.Types.ObjectId;
}

// "sucursalId": "671ae0285c63b9b3b87a02c8"
export interface IDescuentoCreate {
  nombre: string;
  tipoDescuento: 'porcentaje' | 'valor';
  valorDescuento: number;
  fechaInicio: Date;
  fechaFin: Date;
  minimoCompra?: Types.Decimal128;
  minimoCantidad?: number;
  activo: boolean;
  moneda_id: mongoose.Types.ObjectId;
  codigoDescunto: string
  deleted_at: Date | null;
  tipoDescuentoEntidad: ITipoDescuentoEntidad,
  productId?: mongoose.Types.ObjectId,
  groupId?: mongoose.Types.ObjectId,
  sucursalId?: mongoose.Types.ObjectId,
  minimiType:IDescountTypePV
}


export interface IListDescuentoResponse {
  descuentosPorProductosGenerales: IDescuentosProductos[];
  descuentosPorProductosEnSucursal: IDescuentosProductos[];
  descuentosPorGruposGenerales: IDescuentoGrupo[];
  descuentosPorGruposEnSucursal: IDescuentoGrupo[];
}

export interface IDescuentoDeleteParams {
  id: string;
  sucursalId?:string;
  productoId?:string; 
  grupoId?:string
}

const descuentoSchema: Schema = new Schema(
  {
    nombre: { type: String, required: true },
    codigoDescunto: { type: String, required: true },
    tipoDescuento: {
      type: String,
      enum: ['porcentaje', 'valor'],
      required: true,
    },
    valorDescuento: { type: Number, required: true },
    fechaInicio: { type: Date, required: true },
    fechaFin: { type: Date, required: true },
    minimoCompra: { type: Schema.Types.Decimal128, default: null },
    minimoCantidad: { type: Number, default: null },
    activo: { type: Boolean, default: true },
    moneda_id: { type: Schema.Types.ObjectId, ref: 'Moneda', required: true },
    deleted_at: { type: Date, default: null },
    minimiType: { type: String, enum: ['cantidad', 'compra'], required: true },
  },
  { timestamps: true }
);

export const Descuento = mongoose.model<IDescuento>(
  'Descuento',
  descuentoSchema
);
