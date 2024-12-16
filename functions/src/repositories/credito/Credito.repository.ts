import { injectable } from 'tsyringe';
import { Credito, ICredito } from '../../models/credito/Credito.model';
import mongoose from 'mongoose';

@injectable()
export class CreditoRepository {
  private model: typeof Credito;

  constructor() {
    this.model = Credito;
  }

  async create(data: Partial<ICredito>, ): Promise<ICredito> {
    const credit = new this.model(data);
    return await credit.save();
  }

  async findByIdWith(id: string, ): Promise<ICredito | null> {
    const credit = this.model.findById(id, null, )
    return await credit.exec();
  }

  async findById(id: string): Promise<ICredito | null> {
    const credit = await this.model.findById(id)
    return credit;
  }

  async findAllByEntity(entidadId: string): Promise<ICredito[]> {
    const credit = this.model.find({ entidadId: new mongoose.Types.ObjectId(entidadId) });
    return await credit.exec();
  }

  async findBySucursalId(sucursalId: string): Promise<ICredito[] | null> {
    const credit = this.model.find({ sucursalId: new mongoose.Types.ObjectId(sucursalId) }).populate([{
      path: 'entidadId',
    }, {
      path: 'transaccionId',
      populate: {
        path: 'usuarioId',
      },
    }]);
    return await credit.exec();
  }

  async updateWith(id: string, data: Partial<ICredito>, ): Promise<ICredito | null> {
    return await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async update(id: string, data: Partial<ICredito>): Promise<ICredito | null> {
    return await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<ICredito | null> {
    return await this.model
      .findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true })
      .exec();
  }
}
