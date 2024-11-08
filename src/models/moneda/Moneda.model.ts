import mongoose, { Schema, Document } from 'mongoose';

export interface IMoneda extends Document {
  nombre: string;
  simbolo: string;
  deleted_at: Date | null;
}

const monedaSchema: Schema = new Schema(
  {
    nombre: { type: String, required: true },
    simbolo: { type: String, required: true },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Moneda = mongoose.model<IMoneda>('Moneda', monedaSchema);
