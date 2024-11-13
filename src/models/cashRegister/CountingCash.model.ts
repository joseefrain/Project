import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IArqueoCaja extends Document {
  cajaId: mongoose.Types.ObjectId;
  usuarioArqueoId: mongoose.Types.ObjectId;
  montoDeclarado: mongoose.Types.Decimal128;
  montoSistema: mongoose.Types.Decimal128;
  diferencia: mongoose.Types.Decimal128;
  fechaArqueo: Date;
  comentarios: string;
}

const arqueoCajaSchema: Schema<IArqueoCaja> = new Schema({
  cajaId: {
    type: Schema.Types.ObjectId,
    ref: 'Caja',
    required: true,
  },
  usuarioArqueoId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  montoDeclarado: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  montoSistema: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  diferencia: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  fechaArqueo: {
    type: Date,
    required: true,
    default: Date.now,
  },
  comentarios: {
    type: String,
    required: false,
  },
});

// Exportamos el modelo como `ArqueoCaja`
const ArqueoCaja: Model<IArqueoCaja> = mongoose.model<IArqueoCaja>('ArqueoCaja', arqueoCajaSchema);

export default ArqueoCaja;
