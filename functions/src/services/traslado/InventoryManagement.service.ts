
import mongoose, { mongo } from 'mongoose';
import { InventarioSucursalRepository } from '../../repositories/inventary/inventarioSucursal.repository';
import { inject, injectable } from 'tsyringe';
import { IInventarioSucursal } from '../../models/inventario/InventarioSucursal.model';
import { IMovimientoInventario, MovimientoInventario } from '../../models/inventario/MovimientoInventario.model';
import { IAddQuantity, ICreateInventarioSucursal, IHandleStockProductBranch, IInit, IManageHerramientaModel, ISubtractQuantity, ISubtractQuantityLoop, tipoMovimientoInventario } from '../../interface/IInventario';
import { dividirDecimal128, multiplicarDecimal128, sumarDecimal128 } from '../../gen/handleDecimal128';

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


  async init({ branchId, listInventarioSucursalId, userId, listProductId, searchWithProductId = false }: IInit): Promise<IInventarioSucursal[]> {
    this._listInventarioSucursal = searchWithProductId
      ? await this.inventarioSucursalRepo.getListProductByProductIds(
          branchId,
          listProductId as string[]
        )
      : await this.inventarioSucursalRepo.getListProductByInventarioSucursalIds(
          branchId,
          listInventarioSucursalId
        );
    this._listInventoryMoved = [];
    this._listUpdatedBranchInventory = [];
    this.userId = new mongoose.Types.ObjectId(userId);

    return this._listInventarioSucursal
  }

  async initHandleStockProductBranch(userId: string): Promise<void> {
    this._listUpdatedBranchInventory = [];
    this._listBranchInventoryAdded = [];
    this._listInventoryMoved = [];
    this.userId = new mongoose.Types.ObjectId(userId);
  }

  async subtractQuantity({ quantity, inventarioSucursalId, isNoSave = false, tipoMovimiento }: ISubtractQuantity): Promise<void | IInventarioSucursal> {
    const inventarioSucursal = this._listInventarioSucursal.find(
      (inventarioSucursal) =>
        (inventarioSucursal._id as mongoose.Types.ObjectId).toString() ===
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
      tipoMovimiento: tipoMovimiento,
      fechaMovimiento: new Date(),
      usuarioId: this.userId,
    });

    isNoSave ? this._listInventoryMoved.push(movimientoInventario) : await movimientoInventario.save();

    inventarioSucursal.stock -= quantity;
    
    if (inventarioSucursal.stock === 0)
      inventarioSucursal.deleted_at = new Date();

    inventarioSucursal.ultimo_movimiento = new Date();

    isNoSave ? this._listUpdatedBranchInventory.push(inventarioSucursal) : await inventarioSucursal.save();

    return inventarioSucursal;
  }

  async addQuantity({ quantity, tipoMovimiento ,inventarioSucursalId , inventarioSucursal , isNoSave = false, cost = 0 }: IAddQuantity): Promise<void> {

    let inventarioSucursalReal:IInventarioSucursal

    if (!inventarioSucursal) {

      if (!inventarioSucursalId) {
        throw new Error('inventarioSucursalId no encontrado');
      }

      const inventarioSucursalWrap = this._listInventarioSucursal.find(
        (inventarioSucursal) =>
          (inventarioSucursal._id as mongoose.Types.ObjectId).toString() ===
          inventarioSucursalId.toString()
      );
      inventarioSucursalReal = inventarioSucursalWrap as IInventarioSucursal;

      if (!inventarioSucursalReal)
        throw new Error('Producto no encontrado en la sucursal');

      let costoUnitario = new mongoose.Types.Decimal128(cost.toString());
      let costoInventario = inventarioSucursalReal.costoUnitario;
      let cantidadEnInventario = new mongoose.Types.Decimal128(inventarioSucursalReal.stock.toString());
  
      if (costoInventario !== costoUnitario) {
        let costTotalProductoEnInventario = multiplicarDecimal128(costoInventario, cantidadEnInventario);
        let costoUnitarioTotal = multiplicarDecimal128(costoUnitario, new mongoose.Types.Decimal128(quantity.toString()));
        let costoTotal = sumarDecimal128(costTotalProductoEnInventario, costoUnitarioTotal);
  
        let cantidadTotal = inventarioSucursalReal.stock + quantity;
        let cantidadTotal128 = new mongoose.Types.Decimal128(cantidadTotal.toString());
  
        let costoReal = dividirDecimal128(costoTotal, cantidadTotal128);
  
        inventarioSucursalReal.costoUnitario = costoReal;
        
      }

    } else {
      inventarioSucursalReal = inventarioSucursal
    }

    if (!inventarioSucursalReal)
      throw new Error('Producto no encontrado en la sucursal');

    let movimientoInventario = new MovimientoInventario({
      inventarioSucursalId: inventarioSucursalReal._id,
      cantidadCambiada: quantity,
      cantidadInicial: inventarioSucursalReal.stock,
      cantidadFinal: inventarioSucursalReal.stock + quantity,
      tipoMovimiento: tipoMovimiento,
      fechaMovimiento: new Date(),
      usuarioId: this.userId,
    });

    isNoSave ? this._listInventoryMoved.push(movimientoInventario) : await movimientoInventario.save();

    inventarioSucursalReal.stock += quantity;
    inventarioSucursalReal.ultimo_movimiento = new Date();
    inventarioSucursalReal.deleted_at = null;

    isNoSave ? this._listUpdatedBranchInventory.push(inventarioSucursalReal) : await inventarioSucursalReal.save();
  }

  async createInventarioSucursal({ isNoSave = false, inventarioSucursal }: ICreateInventarioSucursal): Promise<void> {

    let movimientoInventario = new MovimientoInventario({
      inventarioSucursalId: inventarioSucursal._id,
      cantidadCambiada: inventarioSucursal.stock,
      cantidadInicial: inventarioSucursal.stock,
      cantidadFinal: inventarioSucursal.stock + inventarioSucursal.stock,
      tipoMovimiento: 'entrada',
      fechaMovimiento: new Date(),
      usuarioId: this.userId,
    });

    isNoSave ? this._listInventoryMoved.push(movimientoInventario) : await movimientoInventario.save();

    isNoSave ? this._listBranchInventoryAdded.push(inventarioSucursal) : await inventarioSucursal.save();
  }

  async handleStockProductBranch({  model, quantity, tipoMovimiento }: IHandleStockProductBranch): Promise<void> {
    const inventarioSucursal = await this.inventarioSucursalRepo.findBySucursalIdAndProductId(model.sucursalId.toString(), model.productoId.toString());

    let dataAddQuantity:IAddQuantity = {
      quantity: quantity,
      inventarioSucursal: inventarioSucursal,
      tipoMovimiento,
      isNoSave: true
    };

   let dataCretaeInventarioSucursal:ICreateInventarioSucursal = {
      inventarioSucursal: model,
       
      isNoSave: true
   }

    inventarioSucursal ? await this.addQuantity(dataAddQuantity) : await this.createInventarioSucursal(dataCretaeInventarioSucursal);
  }

  async updateAllBranchInventory(): Promise<void> {
    await this.inventarioSucursalRepo.updateAllInventarioSucursal(this._listUpdatedBranchInventory );
  }

  async saveAllMovimientoInventario(): Promise<void> {
    await this.inventarioSucursalRepo.saveAllMovimientoInventario(this._listInventoryMoved);
  }

  async saveAllBranchInventory(): Promise<void> {
    await this.inventarioSucursalRepo.saveAllInventarioSucursal(this._listBranchInventoryAdded);
  }
  async subtractQuantityLoop({ listItems }:ISubtractQuantityLoop): Promise<void> {
    for await (const item of listItems) {
      await this.subtractQuantity(
        {
          quantity: item.cantidad,
          inventarioSucursalId: item.inventarioSucursalId,
           
          isNoSave: true,
          tipoMovimiento: tipoMovimientoInventario.TRANSFERENCIA
        }
      );
    }

    await this.updateAllBranchInventory();
    await this.saveAllMovimientoInventario();
  }
}
