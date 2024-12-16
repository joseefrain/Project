import mongoose from "mongoose";
import { IInventarioSucursal } from "../models/inventario/InventarioSucursal.model";

export interface ISubtractQuantity {
  quantity: number;
  inventarioSucursalId: mongoose.Types.ObjectId;
  isNoSave: boolean;
  tipoMovimiento:TipoMovimientoInventario;
}


export type TipoMovimientoInventario =
  | 'entrada'
  | 'salida'
  | 'ajuste'
  | 'devolución'
  | 'transferencia'
  | 'compra'
  | 'venta'
  | 'destrucción'
  | 'ajuste por inventario'
  | 'consumo interno'
  | 'promoción'
  | 'reabastecimiento'
  | 'ajuste por daño';

  interface ITipoMovimientoInventario {
    ENTRADA: TipoMovimientoInventario,
    SALIDA: TipoMovimientoInventario,
    AJUSTE: TipoMovimientoInventario,
    DEVOLUCION: TipoMovimientoInventario,
    TRANSFERENCIA: TipoMovimientoInventario,
    COMPRA: TipoMovimientoInventario,
    VENTA: TipoMovimientoInventario,
    DESTRUCCION: TipoMovimientoInventario,
    AJUSTE_POR_INVENTARIO: TipoMovimientoInventario,
    CONSUMO_INTERNO: TipoMovimientoInventario,
    PROMOCION: TipoMovimientoInventario,
    REABASTECIMIENTO: TipoMovimientoInventario,
    AJUSTE_POR_DANO: TipoMovimientoInventario,
  }

  export const tipoMovimientoInventario:ITipoMovimientoInventario = {
    ENTRADA: 'entrada',
    SALIDA: 'salida',
    AJUSTE: 'ajuste',
    DEVOLUCION: 'devolución',
    TRANSFERENCIA: 'transferencia',
    COMPRA: 'compra',
    VENTA: 'venta',
    DESTRUCCION: 'destrucción',
    AJUSTE_POR_INVENTARIO: 'ajuste por inventario',
    CONSUMO_INTERNO: 'consumo interno',
    PROMOCION: 'promoción',
    REABASTECIMIENTO: 'reabastecimiento',
    AJUSTE_POR_DANO: 'ajuste por daño',
  } 

export interface IInit {
  branchId: string;
  listInventarioSucursalId: string[];
  userId: string;
}

export interface IAddQuantity {
  quantity: number;
  inventarioSucursalId?: mongoose.Types.ObjectId;
  inventarioSucursal?: IInventarioSucursal;
  isNoSave?: boolean;
  tipoMovimiento:TipoMovimientoInventario;
  cost?:number;
}

export interface ICreateInventarioSucursal {
  inventarioSucursal: IInventarioSucursal;
  isNoSave?: boolean;
}

export interface IManageHerramientaModel {
  init({ branchId, listInventarioSucursalId }: IInit): void;
}

export interface IHandleStockProductBranch {
  model:IInventarioSucursal; 
  quantity:number
  tipoMovimiento:TipoMovimientoInventario
}

export interface IItemSsubtractQuantityLoop {
  cantidad:number;
  inventarioSucursalId: mongoose.Types.ObjectId;
}

export interface ISubtractQuantityLoop {
  listItems: IItemSsubtractQuantityLoop[];
}