import { injectable } from 'tsyringe';
import { IInventarioSucursal, InventarioSucursal } from '../../models/inventario/InventarioSucursal.model';
import mongoose, { mongo, Types } from 'mongoose';
import { IMovimientoInventario, MovimientoInventario } from '../../models/inventario/MovimientoInventario.model';

@injectable()
export class InventarioSucursalRepository {
  private model: typeof InventarioSucursal;
  private movimientoInventarioModel: typeof MovimientoInventario;

  constructor() {
    this.model = InventarioSucursal;
    this.movimientoInventarioModel = MovimientoInventario;
  }

  async create(data: Partial<IInventarioSucursal>): Promise<IInventarioSucursal> {
    const inventarioSucursal = new this.model(data);
    return inventarioSucursal;
  }

  async createWithSession(data: Partial<IInventarioSucursal>, session: mongoose.mongo.ClientSession): Promise<IInventarioSucursal> {
    const inventarioSucursal = new this.model(data);
    return await inventarioSucursal.save({ session });
  }

  async findById(id: string): Promise<IInventarioSucursal | null> {
    const inventarioSucursal = await this.model.findById(id);

    if (!inventarioSucursal) {
      return null;
    }

    return inventarioSucursal;
  }

  async findAll(
    filters: any = {},
    limit: number = 10,
    skip: number = 0
  ): Promise<IInventarioSucursal[]> {
    const query = this.model.find({ ...filters, deleted_at: null });

    return await query.limit(limit).skip(skip).exec();
  }

  async findByName(
    name: string,
  ): Promise<IInventarioSucursal | null> {
    const inventarioSucursal = await this.model.findOne({ nombre: name });

    return inventarioSucursal;
  }

  async update(
    id: string,
    data: Partial<IInventarioSucursal>
  ): Promise<IInventarioSucursal | null> {
    return await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<IInventarioSucursal | null> {
    return await this.model
      .findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true })
      .exec();
  }

  async restore(id: string): Promise<IInventarioSucursal | null> {
    return await this.model
      .findByIdAndUpdate(id, { deleted_at: null }, { new: true })
      .exec();
  }
  
  async getListProductByInventarioSucursalIds(
    sucursalId: string,
    listInventarioSucursalId: string[]
  ) {
    // Convertir los strings a ObjectId si es necesario
    const sucursalObjectId = new Types.ObjectId(sucursalId);
    const idsToFind = listInventarioSucursalId.map(id => new Types.ObjectId(id));

    // Hacer la consulta usando Mongoose
    const listInventarioSucursal = await this.model.find({
      sucursalId: sucursalObjectId,
      deleted_at: null, // Filtrar por estado de BodegaActivoDesglose
      productoId: { $exists: true }, // Verificar que el activoDesglose exista
      _id: { $in: idsToFind }, // Usar $in para buscar los IDs
    })
      .populate({
        path: 'productoId',
        match: { delete_at: null }, // Filtrar por el estado de ActivoDesglose
      })

    // Filtrar cualquier resultado donde no se haya hecho el populate exitosamente
    return listInventarioSucursal.filter(bodega => bodega.productoId);
  }

  async findBySucursalIdAndProductId(sucursarlIdStr:string, productoIdStr:string) {
    let sucursalId = new mongoose.Types.ObjectId(sucursarlIdStr);
    let productoId = new mongoose.Types.ObjectId(productoIdStr);
    const inventarioSucursal = await this.model.find({sucursalId, productoId}).populate(["productoId", "sucursalId"]);

    return inventarioSucursal[0];
  }

  async saveAllInventarioSucursal(data: IInventarioSucursal[], session: mongo.ClientSession): Promise<void> {
    await this.model.insertMany(data, { session });
  }

  async updateAllInventarioSucursal(data: IInventarioSucursal[], session: mongo.ClientSession): Promise<void> {
    const bulkOps = data.map((detalle) => ({
        updateOne: {
            filter: { _id: detalle._id },
            update: { $set: detalle },
            upsert: true
        }
    }));
  
    await this.model.bulkWrite(bulkOps, { session });
  }

  async saveAllMovimientoInventario(data: IMovimientoInventario[], session: mongo.ClientSession): Promise<void> {
    await this.movimientoInventarioModel.insertMany(data, { session });
  }
}
