import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from '../usuarios/User.model';
import { IInventarioSucursal } from './InventarioSucursal.model';

type tipoMovimiento =
  | 'entrada'
  | 'salida'
  | 'ajuste'
  | 'devolución'
  | 'transferencia'
  | 'compra'
  | 'venta'
  | 'destrucción'
  | 'ajuste por inventario'
  | 'consumo interno'
  | 'promoción'
  | 'reabastecimiento'
  | 'ajuste por daño';
  
export interface IMovimientoInventario extends Document {
  inventarioSucursalId: mongoose.Types.ObjectId | IInventarioSucursal;
  cantidadCambiada: number;
  cantidadInicial: number;
  cantidadFinal: number; 
  tipoMovimiento: tipoMovimiento;
  fechaMovimiento: Date;
  usuarioId: mongoose.Types.ObjectId | IUser;
  deleted_at: Date | null;
}

const movimientoInventarioSchema: Schema = new Schema(
  {
    inventarioSucursalId: {
      type: Schema.Types.ObjectId,
      ref: 'InventarioSucursal',
      required: true,
    },
    cantidadCambiada: { type: Number, required: true },
    cantidadInicial: { type: Number, required: true },
    cantidadFinal: { type: Number, required: true },
    tipoMovimiento: {
      type: String,
      enum: [
        'entrada',
        'salida',
        'ajuste',
        'devolución',
        'transferencia',
        'compra',
        'venta',
        'destrucción',
        'ajuste por inventario',
        'consumo interno',
        'promoción',
        'reabastecimiento',
        'ajuste por daño',
      ],
      required: true,
    },
    fechaMovimiento: { type: Date, required: true },
    usuarioId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deleted_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'update_at' },
  }
);

export const MovimientoInventario = mongoose.model<IMovimientoInventario>(
  'MovimientoInventario',
  movimientoInventarioSchema
);
