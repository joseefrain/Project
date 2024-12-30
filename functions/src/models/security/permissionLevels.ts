export type NIVEL_PERMISO_ENUM = -1 | 0 | 1 | 4 | 5;

export const NIVEL_PERMISO = {
  VOID: -1,       // Sin permiso
  CONSULTAR: 0,   // Permiso de solo lectura
  AGREGAR: 1,     // Permiso para agregar
  EDITAR: 4,      // Permiso para editar
  BORRAR: 5,      // Permiso para eliminar
};