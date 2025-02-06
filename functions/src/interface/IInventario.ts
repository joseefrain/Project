import mongoose from "mongoose";
import { IInventarioSucursal } from "../models/inventario/InventarioSucursal.model";

export interface ISubtractQuantity {
  quantity: number;
  inventarioSucursalId: mongoose.Types.ObjectId;
  isNoSave: boolean;
  tipoMovimiento:TipoMovimientoInventario;
}


  export enum TipoMovimientoInventario {
    ENTRADA = 'entrada',
    SALIDA = 'salida',
    AJUSTE = 'ajuste',
    DEVOLUCION = 'devolución',
    TRANSFERENCIA = 'transferencia',
    COMPRA = 'compra',
    VENTA = 'venta',
    DESTRUCCION = 'destrucción',
    AJUSTE_POR_INVENTARIO = 'ajuste por inventario',
    CONSUMO_INTERNO = 'consumo interno',
    PROMOCION = 'promoción',
    REABASTECIMIENTO = 'reabastecimiento',
    AJUSTE_POR_DANO = 'ajuste por daño',
  }
export interface IInit {
  branchId: string;
  listInventarioSucursalId: string[];
  userId: string;
  listProductId?: string[]
  searchWithProductId?: boolean
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