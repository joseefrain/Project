import mongoose, { Document, Schema, Model } from 'mongoose';
import { ITypeCashRegisterMovement } from '../../interface/ICaja';

export interface IMovimientoCaja extends Document {
  cajaId: mongoose.Types.ObjectId;
  tipoMovimiento: ITypeCashRegisterMovement;
  usuarioId: mongoose.Types.ObjectId;
  monto: mongoose.Types.Decimal128;
  cambioCliente?: mongoose.Types.Decimal128 | null;  // Nuevo campo opcional para cambio al cliente
  descripcion: string;
  trasaccionId: mongoose.Types.ObjectId | null;
  fecha: Date;
  esDineroExterno: boolean;
  montoExterno?: mongoose.Types.Decimal128 | null;
}

const movimientoCajaSchema: Schema<IMovimientoCaja> = new Schema({
  cajaId: {
    type: Schema.Types.ObjectId,
    ref: 'Caja',
    required: true,
  },
  tipoMovimiento: {
    type: String,
    enum: ['VENTA', 'INGRESO', 'EGRESO', "COMPRA", "APERTURA", 'DEVOLUCION'],
    required: true,
  },
  usuarioId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  monto: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  cambioCliente: {
    type: Schema.Types.Decimal128,
    default: null,
  },
  descripcion: {
    type: String,
    required: true,
  },
  fecha: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

// Exportamos el modelo como `MovimientoCaja`
const MovimientoCaja: Model<IMovimientoCaja> = mongoose.model<IMovimientoCaja>('MovimientoCaja', movimientoCajaSchema);

export default MovimientoCaja;
