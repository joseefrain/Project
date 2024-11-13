import { FilterQuery, Model, mongo } from 'mongoose';
import MovimientoCaja, { IMovimientoCaja } from '../../models/cashRegister/CashRegisterMovement.model';

export class MovimientoCajaRepository {
  private model: Model<IMovimientoCaja>;

  constructor() {
    this.model = MovimientoCaja;
  }

  // Método para crear un nuevo movimiento de caja
  async create(data: Partial<IMovimientoCaja>, session: mongo.ClientSession): Promise<IMovimientoCaja> {
    try {
      const movimiento = new this.model(data);
      return await movimiento.save({ session });
    } catch (error) {
      throw new Error(`Error al crear MovimientoCaja: ${error.message}`);
    }
  }

  // Método para obtener un movimiento por ID
  async findById(id: string): Promise<IMovimientoCaja | null> {
    try {
      return await this.model.findById(id).populate('cajaId usuarioId').exec();
    } catch (error) {
      throw new Error(`Error al obtener MovimientoCaja por ID: ${error.message}`);
    }
  }

  // Método para obtener todos los movimientos con filtros opcionales y paginación
  async findAll(
    filters: FilterQuery<IMovimientoCaja> = {},
    limit: number = 10,
    skip: number = 0
  ): Promise<IMovimientoCaja[]> {
    try {
      return await this.model.find(filters)
        .populate('cajaId usuarioId')
        .limit(limit)
        .skip(skip)
        .exec();
    } catch (error) {
      throw new Error(`Error al obtener movimientos de caja: ${error.message}`);
    }
  }

  // Método para actualizar un movimiento por ID
  async updateById(id: string, updateData: Partial<IMovimientoCaja>): Promise<IMovimientoCaja | null> {
    try {
      return await this.model.findByIdAndUpdate(id, updateData, { new: true }).exec();
    } catch (error) {
      throw new Error(`Error al actualizar MovimientoCaja: ${error.message}`);
    }
  }

  // Método para eliminar un movimiento por ID
  async deleteById(id: string): Promise<IMovimientoCaja | null> {
    try {
      return await this.model.findByIdAndDelete(id).exec();
    } catch (error) {
      throw new Error(`Error al eliminar MovimientoCaja: ${error.message}`);
    }
  }

  // Método para contar la cantidad de movimientos según ciertos filtros
  async count(filters: FilterQuery<IMovimientoCaja> = {}): Promise<number> {
    try {
      return await this.model.countDocuments(filters).exec();
    } catch (error) {
      throw new Error(`Error al contar movimientos de caja: ${error.message}`);
    }
  }

  // Método para buscar los movimientos por rango de fechas
  async findByDateRange(startDate: Date, endDate: Date): Promise<IMovimientoCaja[]> {
    try {
      return await this.model.find({
        fecha: { $gte: startDate, $lte: endDate }
      }).populate('cajaId usuarioId').exec();
    } catch (error) {
      throw new Error(`Error al obtener movimientos en rango de fechas: ${error.message}`);
    }
  }
}