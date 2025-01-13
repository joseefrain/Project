export type NIVEL_PERMISO_ENUM = 0 | 1 | 4 | 5;

export const NIVEL_PERMISO = {
  CONSULTAR: 0,   // Permiso de solo lectura
  AGREGAR: 1,     // Permiso para agregar
  EDITAR: 4,      // Permiso para editar
  BORRAR: 5,      // Permiso para eliminar
};

export enum PAGES_MODULES {
  DASHBOARD = 'DASHBOARD',
  SUCURSALES = 'SUCURSALES',
  TRANSACCIONES = 'TRANSACCIONES',
  CREDITOS = 'CREDITOS',
  PRODUCTOS = 'PRODUCTOS',
  CATEGORIAS = 'CATEGORIAS',
  DESCUENTOS = 'DESCUENTOS',
  TRASLADOS = 'TRASLADOS',
  USUARIOS = 'USUARIOS',
  CONTACTOS = 'CONTACTOS',
  ROLES = 'ROLES',
}

export enum LEVEL_VALUES {
  CONSULTAR = 0,
  AGREGAR = 1,
  EDITAR = 4,
  BORRAR = 5,
}

export interface IRolePrivilege {
  module: string;
  levels: NIVEL_PERMISO_ENUM[];
}

export const DEFAULT_ROLE_PAGES: IRolePrivilege[] = [
  {
    module: PAGES_MODULES.DASHBOARD,
    levels: [LEVEL_VALUES.CONSULTAR],
  },
  {
    module: PAGES_MODULES.SUCURSALES,
    levels: [
      LEVEL_VALUES.AGREGAR,
      LEVEL_VALUES.CONSULTAR,
      LEVEL_VALUES.EDITAR,
      LEVEL_VALUES.BORRAR,
    ],
  },
  {
    module: PAGES_MODULES.TRANSACCIONES,
    levels: [
      LEVEL_VALUES.AGREGAR,
      LEVEL_VALUES.CONSULTAR,
      LEVEL_VALUES.EDITAR,
      LEVEL_VALUES.BORRAR,
    ],
  },
  {
    module: PAGES_MODULES.CREDITOS,
    levels: [
      LEVEL_VALUES.AGREGAR,
      LEVEL_VALUES.CONSULTAR,
      LEVEL_VALUES.EDITAR,
      LEVEL_VALUES.BORRAR,
    ],
  },
  {
    module: PAGES_MODULES.PRODUCTOS,
    levels: [
      LEVEL_VALUES.AGREGAR,
      LEVEL_VALUES.CONSULTAR,
      LEVEL_VALUES.EDITAR,
      LEVEL_VALUES.BORRAR,
    ],
  },
  {
    module: PAGES_MODULES.CATEGORIAS,
    levels: [
      LEVEL_VALUES.AGREGAR,
      LEVEL_VALUES.CONSULTAR,
      LEVEL_VALUES.EDITAR,
      LEVEL_VALUES.BORRAR,
    ],
  },
  {
    module: PAGES_MODULES.DESCUENTOS,
    levels: [
      LEVEL_VALUES.AGREGAR,
      LEVEL_VALUES.CONSULTAR,
      LEVEL_VALUES.EDITAR,
      LEVEL_VALUES.BORRAR,
    ],
  },
  {
    module: PAGES_MODULES.TRASLADOS,
    levels: [
      LEVEL_VALUES.AGREGAR,
      LEVEL_VALUES.CONSULTAR,
      LEVEL_VALUES.EDITAR,
      LEVEL_VALUES.BORRAR,
    ],
  },
  {
    module: PAGES_MODULES.USUARIOS,
    levels: [
      LEVEL_VALUES.AGREGAR,
      LEVEL_VALUES.CONSULTAR,
      LEVEL_VALUES.EDITAR,
      LEVEL_VALUES.BORRAR,
    ],
  },
  {
    module: PAGES_MODULES.CONTACTOS,
    levels: [
      LEVEL_VALUES.AGREGAR,
      LEVEL_VALUES.CONSULTAR,
      LEVEL_VALUES.EDITAR,
      LEVEL_VALUES.BORRAR,
    ],
  },
  {
    module: PAGES_MODULES.ROLES,
    levels: [
      LEVEL_VALUES.AGREGAR,
      LEVEL_VALUES.CONSULTAR,
      LEVEL_VALUES.EDITAR,
      LEVEL_VALUES.BORRAR,
    ],
  },
];