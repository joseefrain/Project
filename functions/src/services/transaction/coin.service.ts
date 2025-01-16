import { injectable, inject } from 'tsyringe';
import { IMoneda } from '../../models/moneda/Moneda.model';
import { CoinRepository } from '../../repositories/transaction/coin.repository';
import { DeleteResult } from 'mongoose';

@injectable()
export class CoinService {
  constructor(
    @inject(CoinRepository) private repository: CoinRepository,
  ) {}

  async createCoin(data: Partial<IMoneda>): Promise<IMoneda | null> {
    const coinExists = await this.repository.findByName(data.nombre!);

    if (coinExists) {
      throw new Error('role already exists');
    }

    const newCoin = await this.repository.create(data);

    return newCoin;
  }


  async getCoinById(id: string): Promise<IMoneda | null> {
    const coin = await this.repository.findById(id);
    if (!coin) {
      throw new Error('role not found');
    }
    return coin;
  }

  async getAllCoins(
    filters: any,
    limit: number,
    skip: number
  ): Promise<IMoneda[]> {
    return this.repository.findAll(filters, limit, skip);
  }

  async modifyCoin(id: string, data: Partial<IMoneda>): Promise<IMoneda | null> {
    const coin = await this.repository.update(id, data);
    if (!coin) {
      throw new Error('role not found');
    }
    return coin;
  }

  async deleteCoin(id: string): Promise<DeleteResult> {
    const coin = await this.repository.delete(id);
    if (!coin) {
      throw new Error('role not found');
    }
    return coin;
  }
}
