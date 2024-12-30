import { NIVEL_PERMISO_ENUM } from "./permissionLevels";
import mongoose, { Schema, Document } from 'mongoose';

interface IPrivileges {
  module: string;
  levels: number[];
}


export interface IRole extends Document {
  name: string;
  privileges: IPrivileges[];
}

const RoleSchema:Schema = new mongoose.Schema<IRole>({
  name: { type: String, required: true }, // Nombre del rol, Ej: 'admin', 'editor', 'viewer'

  // Privilegios organizados por módulos
  privileges: [
    {
      module: { type: String, required: true }, // Nombre del módulo, Ej: 'productos', 'ventas'
      levels: [{ type: Number, enum: [-1, 0, 1, 4, 5] }], // Array de niveles de permiso
    },
  ],
});

export const Role = mongoose.model<IRole>('Role', RoleSchema);
