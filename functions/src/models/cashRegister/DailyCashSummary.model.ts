import mongoose, { Document, Schema, Model } from 'mongoose';
import { ITransaccion, ITransaccionCreate, Transaccion } from '../transaction/Transaction.model';

export interface IResumenCajaDiario extends Document {
  sucursalId: mongoose.Types.ObjectId;
  cajaId: mongoose.Types.ObjectId;
  fecha: Date;
  totalVentas: mongoose.Types.Decimal128;
  totalCompras: mongoose.Types.Decimal128;
  totalIngresos: mongoose.Types.Decimal128;
  totalEgresos: mongoose.Types.Decimal128;
  montoFinalSistema: mongoose.Types.Decimal128;
  montoDeclaradoPorUsuario?: mongoose.Types.Decimal128 | null;
  diferencia?: mongoose.Types.Decimal128 | null;
  ventas: mongoose.Types.ObjectId[] | ITransaccion[];
  compras: mongoose.Types.ObjectId[] | ITransaccion[];
}

const resumenCajaDiarioSchema: Schema<IResumenCajaDiario> = new Schema({

  sucursalId: {
    type: Schema.Types.ObjectId,
    ref: 'Sucursal',
    required: true,
  },
  cajaId: {
    type: Schema.Types.ObjectId,
    ref: 'Caja',
    required: true,
  },
  fecha: {
    type: Date,
    required: true,
  },
  totalVentas: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  totalCompras: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  totalIngresos: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  totalEgresos: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  montoFinalSistema: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  montoDeclaradoPorUsuario: {
    type: Schema.Types.Decimal128,
    default: null,
  },
  diferencia: {
    type: Schema.Types.Decimal128,
    default: null,
  },
  ventas: {
    type: [{ type: mongoose.Types.ObjectId, ref: Transaccion }],
    required: true,
  },
  compras: {
    type: [{ type: mongoose.Types.ObjectId, ref: Transaccion }],
    required: true,
  },
});

// Exportamos el modelo como `ResumenCajaDiario`
const ResumenCajaDiario: Model<IResumenCajaDiario> = mongoose.model<IResumenCajaDiario>('ResumenCajaDiario', resumenCajaDiarioSchema);

export default ResumenCajaDiario;
