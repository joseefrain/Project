import mongoose, { Document, Schema, Model } from 'mongoose';
import { ISucursal } from '../sucursales/Sucursal.model';
import { IUser } from '../usuarios/User.model';

export interface ICaja extends Document {
  sucursalId: mongoose.Types.ObjectId | ISucursal;
  usuarioAperturaId: mongoose.Types.ObjectId | IUser;
  montoInicial: mongoose.Types.Decimal128;
  montoEsperado: mongoose.Types.Decimal128;
  montoFinalDeclarado?: mongoose.Types.Decimal128 | null;
  diferencia?: mongoose.Types.Decimal128 | null;
  fechaApertura: Date;
  fechaCierre?: Date | null;
  estado: 'abierta' | 'cerrada';
}

const cajaSchema: Schema<ICaja> = new Schema({
  sucursalId: {
    type: Schema.Types.ObjectId,
    ref: 'Sucursal',
    required: true,
  },
  usuarioAperturaId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
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
    required: true,
    default: Date.now,
  },
  fechaCierre: {
    type: Date,
    default: null,
  },
  estado: {
    type: String,
    enum: ['abierta', 'cerrada'],
    required: true,
    default: 'abierta',
  },
});

// Exportamos el modelo como `Caja`
const Caja: Model<ICaja> = mongoose.model<ICaja>('Caja', cajaSchema);

export default Caja;
