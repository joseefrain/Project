import mongoose, { mongo } from 'mongoose';
import { InventarioSucursalRepository } from '../../repositories/inventary/inventarioSucursal.repository';
import { inject, injectable } from 'tsyringe';
import { IInventarioSucursal } from '../../models/inventario/InventarioSucursal.model';
import { IMovimientoInventario, MovimientoInventario } from '../../models/inventario/MovimientoInventario.model';
import { IAddQuantity, ICreateInventarioSucursal, IHandleStockProductBranch, IInit, IManageHerramientaModel, ISubtractQuantity, ISubtractQuantityLoop } from '../../interface/IInventario';

@injectable()
export class InventoryManagementService implements IManageHerramientaModel {

  private userId: mongoose.Types.ObjectId;
  private _listInventarioSucursal: IInventarioSucursal[];
  private _listBranchInventoryAdded: IInventarioSucursal[];
  private _listUpdatedBranchInventory: IInventarioSucursal[];
  private _listInventoryMoved: IMovimientoInventario[];

  constructor(
    @inject(InventarioSucursalRepository)
    private inventarioSucursalRepo: InventarioSucursalRepository,
  ) {}


  async init({ branchId, listInventarioSucursalId, userId }: IInit): Promise<void> {

    this._listInventarioSucursal =
      await this.inventarioSucursalRepo.getListProductByInventarioSucursalIds(
        branchId,
        listInventarioSucursalId
      );
      this._listInventoryMoved = [];
      this._listUpdatedBranchInventory = [];
      this.userId = new mongoose.Types.ObjectId(userId);
  }

  async initHandleStockProductBranch(userId: string): Promise<void> {
    this._listUpdatedBranchInventory = [];
    this._listBranchInventoryAdded = [];
    this._listInventoryMoved = [];
    this.userId = new mongoose.Types.ObjectId(userId);
  }

  async subtractQuantity({ quantity, inventarioSucursalId, session, isNoSave = false }: ISubtractQuantity): Promise<void | IInventarioSucursal> {
    const inventarioSucursal = this._listInventarioSucursal.find(
      (sucursal) =>
        (sucursal._id as mongoose.Types.ObjectId).toString() ===
        inventarioSucursalId.toString()
    );

    if (!inventarioSucursal)
      throw new Error('Producto no encontrado en la sucursal');

    if (quantity > inventarioSucursal.stock)
      throw new Error('Cantidad a sustraer es mayor a la disponible.');

    let movimientoInventario = new MovimientoInventario({
      inventarioSucursalId: inventarioSucursal._id,
      cantidadCambiada: quantity,
      cantidadInicial: inventarioSucursal.stock,
      cantidadFinal: inventarioSucursal.stock - quantity,
      tipoMovimiento: 'transferencia',
      fechaMovimiento: new Date(),
      usuarioId: this.userId,
    });

    isNoSave ? this._listInventoryMoved.push(movimientoInventario) : await movimientoInventario.save({ session });

    inventarioSucursal.stock -= quantity;
    
    if (inventarioSucursal.stock === 0)
      inventarioSucursal.deleted_at = new Date();

    inventarioSucursal.ultimo_movimiento = new Date();

    isNoSave ? this._listUpdatedBranchInventory.push(inventarioSucursal) : await inventarioSucursal.save({ session });

    return inventarioSucursal;
  }

  async addQuantity({ quantity, inventarioSucursal, session, list, isNoSave = false }: IAddQuantity): Promise<void> {
    let movimientoInventario = new MovimientoInventario({
      inventarioSucursalId: inventarioSucursal._id,
      cantidadCambiada: quantity,
      cantidadInicial: inventarioSucursal.stock,
      cantidadFinal: inventarioSucursal.stock + quantity,
      tipoMovimiento: 'transferencia',
      fechaMovimiento: new Date(),
      usuarioId: this.userId,
    });

    isNoSave ? this._listInventoryMoved.push(movimientoInventario) : await movimientoInventario.save({ session });

    inventarioSucursal.stock += quantity;
    inventarioSucursal.ultimo_movimiento = new Date();
    inventarioSucursal.deleted_at = null;

    isNoSave ? list.push(inventarioSucursal) : await inventarioSucursal.save({ session });
  }

  async createInventarioSucursal({ list, isNoSave = false, inventarioSucursal, session }: ICreateInventarioSucursal): Promise<void> {

    let movimientoInventario = new MovimientoInventario({
      inventarioSucursalId: inventarioSucursal._id,
      cantidadCambiada: inventarioSucursal.stock,
      cantidadInicial: inventarioSucursal.stock,
      cantidadFinal: inventarioSucursal.stock + inventarioSucursal.stock,
      tipoMovimiento: 'entrada',
      fechaMovimiento: new Date(),
      usuarioId: this.userId,
    });

    isNoSave ? this._listInventoryMoved.push(movimientoInventario) : await movimientoInventario.save({ session });

    isNoSave ? list.push(inventarioSucursal) : await inventarioSucursal.save({ session });
  }

  async handleStockProductBranch({ session, model, quantity }: IHandleStockProductBranch): Promise<void> {
    const inventarioSucursal = await this.inventarioSucursalRepo.findBySucursalIdAndProductId(model.sucursalId.toString(), model.productoId.toString());

    let dataAddQuantity:IAddQuantity = {
      quantity: quantity,
      inventarioSucursal: inventarioSucursal,
      session: session,
      list: this._listUpdatedBranchInventory,
      isNoSave: true
    };

   let dataCretaeInventarioSucursal:ICreateInventarioSucursal = {
      list: this._listBranchInventoryAdded,
      inventarioSucursal: model,
      session: session,
      isNoSave: true
   }

    inventarioSucursal ? await this.addQuantity(dataAddQuantity) : await this.createInventarioSucursal(dataCretaeInventarioSucursal);
  }

  async updateAllBranchInventory(session: mongo.ClientSession): Promise<void> {
    await this.inventarioSucursalRepo.updateAllInventarioSucursal(this._listUpdatedBranchInventory , session);
  }

  async saveAllMovimientoInventario(session: mongo.ClientSession): Promise<void> {
    await this.inventarioSucursalRepo.saveAllMovimientoInventario(this._listInventoryMoved, session);
  }

  async saveAllBranchInventory(session: mongo.ClientSession): Promise<void> {
    await this.inventarioSucursalRepo.saveAllInventarioSucursal(this._listBranchInventoryAdded, session);
  }
  async subtractQuantityLoop({ listItems, session }:ISubtractQuantityLoop): Promise<void> {
    for await (const item of listItems) {
      await this.subtractQuantity(
        {
          quantity: item.cantidad,
          inventarioSucursalId: item.inventarioSucursalId,
          session: session,
          isNoSave: true
        }
      );
    }

    await this.updateAllBranchInventory(session);
    await this.saveAllMovimientoInventario(session);
  }
}
