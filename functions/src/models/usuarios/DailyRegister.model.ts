import mongoose, { Document, Schema, Types } from 'mongoose';
import { IUser } from './User.model';


// Interfaz para tipar los usuarios
export interface IDailyRegister extends Document {
  userId: Types.ObjectId | IUser;
  date: Date;
  startWork: Date;
  endWork: Date;
  hourEntry: Date;
  hourExit: Date | null;
  lateEntry: boolean
  note: string;
  deleted_at: Date | null;
}

// Definir el esquema de usuario
const DailyRegisterSchema: Schema<IDailyRegister> = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  startWork: {
    type: Date,
    required: true,
  },
  endWork: {
    type: Date,
    required: true,
  },
  lateEntry: {
    type: Boolean,
    default: false,
  },
  note: {
    type: String,
    default: '',
  },
  hourEntry: {
    type: Date,
    required: true,
  },
  hourExit: {
    type: Date,
    default: null,
  },
  deleted_at: { type: Date, default: null },
});

// Agregar validación de fechas en el esquema
DailyRegisterSchema.path('date').validate(function(date: Date) {
  return date <= new Date();
}, 'La fecha no puede ser en el futuro');

DailyRegisterSchema.path('hourExit').validate(function(this: IDailyRegister, hourExit: Date) {
  return hourExit > this.hourEntry;
}, 'La hora de salida debe ser posterior a la de entrada');

export const DailyRegisterModel = mongoose.model<IDailyRegister>('DailyRegister', DailyRegisterSchema);