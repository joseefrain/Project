import mongoose, { Model, Schema } from "mongoose";
import { ICredito } from "./Credito.model";

type TypeMovimientoFinanciero = 'ABONO' | 'CARGO'

export interface IMovimientoFinanciero extends Document {
  fechaMovimiento: Date;
  tipoMovimiento: TypeMovimientoFinanciero;
  monto: mongoose.Types.Decimal128;
  creditoId: mongoose.Types.ObjectId | ICredito;
}

const movimientoFinancieroSchema: Schema<IMovimientoFinanciero> = new Schema({
  fechaMovimiento: { type: Date, required: true },
  tipoMovimiento: { type: String, enum: ['ABONO', 'CARGO'], required: true },
  monto: { type: Schema.Types.Decimal128, required: true },
  creditoId: { type: Schema.Types.ObjectId, ref: 'Credito', required: true },
}); 

export const MovimientoFinanciero: Model<IMovimientoFinanciero> = mongoose.model<IMovimientoFinanciero>(
  'MovimientosFinanciero',
  movimientoFinancieroSchema
);