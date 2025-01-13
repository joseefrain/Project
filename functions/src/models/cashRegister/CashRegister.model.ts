import mongoose, { Document, Schema, Model } from 'mongoose';
import { ISucursal } from '../sucursales/Sucursal.model';
import { IUser, User } from '../usuarios/User.model';

export type stateCashRegister = 'ABIERTA' | 'CERRADA';
export interface ICajaHistorico {
  fechaApertura: Date;
  fechaCierre: Date;
  montoInicial: mongoose.Types.Decimal128;
  montoFinalDeclarado: mongoose.Types.Decimal128;
  diferencia: mongoose.Types.Decimal128;
  montoEsperado: mongoose.Types.Decimal128;
  usuarioAperturaId: mongoose.Types.ObjectId | IUser;
}

const cajaHistoricoSchema: Schema<ICajaHistorico> = new Schema(
  {
    fechaApertura: { type: Date, required: true },
    fechaCierre: { type: Date, required: true },
    montoInicial: { type: mongoose.Types.Decimal128, required: true },
    montoFinalDeclarado: { type: mongoose.Types.Decimal128, required: true },
    diferencia: { type: mongoose.Types.Decimal128, required: true },
    montoEsperado: { type: mongoose.Types.Decimal128, required: true },
    usuarioAperturaId: { type: Schema.Types.ObjectId, ref: User, required: true },
  },
  { _id: false }
);

export interface ICaja extends Document {
  sucursalId: mongoose.Types.ObjectId | ISucursal;
  usuarioAperturaId: mongoose.Types.ObjectId | IUser | null;
  montoInicial: mongoose.Types.Decimal128;
  montoEsperado: mongoose.Types.Decimal128;
  montoFinalDeclarado?: mongoose.Types.Decimal128 | null;
  diferencia?: mongoose.Types.Decimal128 | null;
  fechaApertura: Date | null;
  fechaCierre?: Date | null;
  estado: stateCashRegister;
  hasMovementCashier: boolean;
  historico: ICajaHistorico[];
  consecutivo: number;
}

const cajaSchema: Schema<ICaja> = new Schema({
  sucursalId: {
    type: Schema.Types.ObjectId,
    ref: 'Sucursal',
    required: true,
  },
  consecutivo: { type: Number, required: true },
  usuarioAperturaId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  montoInicial: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  montoEsperado: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  montoFinalDeclarado: {
    type: Schema.Types.Decimal128,
    default: null,
  },
  diferencia: {
    type: Schema.Types.Decimal128,
    default: null,
  },
  fechaApertura: {
    type: Date,
    default: Date.now,
  },
  fechaCierre: {
    type: Date,
    default: null,
  },
  estado: {
    type: String,
    enum: ['ABIERTA', 'CERRADA'],
    required: true,
    default: 'CERRADA',
  },
  hasMovementCashier: {
    type: Boolean,
    default: false,
  },
  historico: [{ type: cajaHistoricoSchema, required: true }],
});

// Exportamos el modelo como `Caja`
const Caja: Model<ICaja> = mongoose.model<ICaja>('Caja', cajaSchema);

export default Caja;
