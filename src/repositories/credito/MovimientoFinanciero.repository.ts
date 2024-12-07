import { injectable } from 'tsyringe';
import { MovimientoFinanciero, IMovimientoFinanciero } from '../../models/credito/MovimientoFinanciero.model';
import { mongo } from 'mongoose';

@injectable()
export class MovimientoFinancieroRepository {
  private model: typeof MovimientoFinanciero;

  constructor() {
    this.model = MovimientoFinanciero;
  }

  async create(data: Partial<IMovimientoFinanciero>, session: mongo.ClientSession): Promise<IMovimientoFinanciero> {
    const movimiento = new this.model(data);
    return await movimiento.save({ session });
  }

  async findById(id: string): Promise<IMovimientoFinanciero | null> {
    const movimiento = this.model.findById(id)
    return await movimiento.exec();
  }

  async findAll(
    filters: any = {},
    limit: number = 10,
    skip: number = 0
  ): Promise<IMovimientoFinanciero[]> {
    const movimiento = this.model.find({ ...filters, deleted_at: null });
    return await movimiento.limit(limit).skip(skip).exec();
  }

  async update(id: string, data: Partial<IMovimientoFinanciero>): Promise<IMovimientoFinanciero | null> {
    return await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<IMovimientoFinanciero | null> {
    return await this.model
      .findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true })
      .exec();
  }
}
