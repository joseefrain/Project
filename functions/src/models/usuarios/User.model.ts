import mongoose, { Document, Query, Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import { ISucursal } from '../sucursales/Sucursal.model';
import { IRole, Role } from '../security/Role.model';

export enum ROL {
  ADMIN = 'ADMIN',
  ROOT = 'ROOT',
  EMPLEADO = 'EMPLEADO',
}

// Interfaz para tipar los usuarios
export interface IUser extends Document {
  username: string;
  password: string;
  roles: mongoose.Types.ObjectId[] | IRole[];
  role: ROL;
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
  roles: {
    type: [{ type: Schema.Types.ObjectId, ref: Role }],
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

UserSchema.pre<Query<any, IUser>>('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() as IUser; // Obtener el objeto de actualización

  // Verificar si el campo `password` está siendo modificado
  if (update && update.password) {
    const salt = await bcrypt.genSalt(10);
    update.password = await bcrypt.hash(update.password, salt);

    // Guardar los cambios en el query
    this.setUpdate(update);
  }

  next();
});


export const User = mongoose.model<IUser>('User', UserSchema);