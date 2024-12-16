import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import { ISucursal } from '../sucursales/Sucursal.model';

// Interfaz para tipar los usuarios
export interface IUser extends Document {
  username: string;
  password: string;
  role: string;
  sucursalId: mongoose.Types.ObjectId | ISucursal | null;
  deleted_at: Date | null;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IResponseLogin {
  token: string;
  user: IUser;
}

// Definir el esquema de usuario
const UserSchema: Schema<IUser> = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
  },
  sucursalId: { type: Schema.Types.ObjectId, ref: 'Sucursal', default: null },
  deleted_at: { type: Date, default: null },
});

// Método para comparar contraseñas usando bcrypt
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Hash de la contraseña antes de guardar el usuario
UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

export const User = mongoose.model<IUser>('User', UserSchema);