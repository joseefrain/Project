import { injectable } from 'tsyringe';
import { IMoneda, Moneda } from '../../models/moneda/Moneda.model';
import { DeleteResult } from 'mongoose';

@injectable()
export class CoinRepository {
  private model: typeof Moneda;

  constructor() {
    this.model = Moneda;
  }

  async create(data: Partial<IMoneda>): Promise<IMoneda | null> {
    const coin = new this.model(data);
    await coin.save();
    return coin;
  }

  async findById(id: string): Promise<IMoneda | null> {
    const query = this.model.findById(id);
    return await query.exec();
  }

  async findListByIds(ids: string[]): Promise<IMoneda[]> {
    const query = this.model.find({ _id: { $in: ids } });
    return await query.exec();
  }

  async findByName(nombre: string): Promise<IMoneda | null> {
    const query = this.model.findOne({ nombre });

    return await query.exec();
  }

  async findAll(
    filters: any = {},
    limit: number = 10,
    skip: number = 0
  ): Promise<IMoneda[]> {
    const query = this.model.find({ ...filters, deleted_at: null });
    return await query.limit(limit).skip(skip).exec();
  }

  async update(id: string, data: Partial<IMoneda>): Promise<IMoneda | null> {
    return await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async updateWith(id: string, data: Partial<IMoneda>, ): Promise<IMoneda | null> {
    return await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<DeleteResult> {
    let coin = await this.model.deleteOne({ _id: id }).exec();

    return coin;
  }
}
