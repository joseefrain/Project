import { Model, FilterQuery } from 'mongoose';
import ArqueoCaja, { IArqueoCaja } from '../../models/cashRegister/CountingCash.model';

export class ArqueoCajaRepository {
  private model: Model<IArqueoCaja>;

  constructor() {
    this.model = ArqueoCaja;
  }

  // Método para crear un nuevo arqueo de caja
  async create(data: Partial<IArqueoCaja>): Promise<IArqueoCaja> {
    try {
      const arqueoCaja = new this.model(data);
      return await arqueoCaja.save();
    } catch (error) {
      throw new Error(`Error al crear ArqueoCaja: ${error.message}`);
    }
  }

  // Método para obtener un arqueo por ID
  async findById(id: string): Promise<IArqueoCaja | null> {
    try {
      return await this.model.findById(id).populate('cajaId usuarioArqueoId').exec();
    } catch (error) {
      throw new Error(`Error al obtener ArqueoCaja por ID: ${error.message}`);
    }
  }

  // Método para obtener todos los arqueos con filtros opcionales y paginación
  async findAll(
    filters: FilterQuery<IArqueoCaja> = {},
    limit: number = 10,
    skip: number = 0
  ): Promise<IArqueoCaja[]> {
    try {
      return await this.model.find(filters)
        .populate('cajaId usuarioArqueoId')
        .limit(limit)
        .skip(skip)
        .exec();
    } catch (error) {
      throw new Error(`Error al obtener arqueos de caja: ${error.message}`);
    }
  }

  // Método para actualizar un arqueo por ID
  async updateById(id: string, updateData: Partial<IArqueoCaja>): Promise<IArqueoCaja | null> {
    try {
      return await this.model.findByIdAndUpdate(id, updateData, { new: true }).exec();
    } catch (error) {
      throw new Error(`Error al actualizar ArqueoCaja: ${error.message}`);
    }
  }

  // Método para eliminar un arqueo por ID
  async deleteById(id: string): Promise<IArqueoCaja | null> {
    try {
      return await this.model.findByIdAndDelete(id).exec();
    } catch (error) {
      throw new Error(`Error al eliminar ArqueoCaja: ${error.message}`);
    }
  }

  // Método para contar la cantidad de arqueos según ciertos filtros
  async count(filters: FilterQuery<IArqueoCaja> = {}): Promise<number> {
    try {
      return await this.model.countDocuments(filters).exec();
    } catch (error) {
      throw new Error(`Error al contar arqueos de caja: ${error.message}`);
    }
  }

  // Método para buscar arqueos por rango de fechas
  async findByDateRange(startDate: Date, endDate: Date): Promise<IArqueoCaja[]> {
    try {
      return await this.model.find({
        fechaArqueo: { $gte: startDate, $lte: endDate }
      }).populate('cajaId usuarioArqueoId').exec();
    } catch (error) {
      throw new Error(`Error al obtener arqueos en rango de fechas: ${error.message}`);
    }
  }
}
