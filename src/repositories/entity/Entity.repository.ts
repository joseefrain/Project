import { injectable } from 'tsyringe';
import { Entity, IEntity } from '../../models/entity/Entity.model';
import mongoose from 'mongoose';

@injectable()
export class EntityRepository {
  private model: typeof Entity;

  constructor() {
    this.model = Entity;
  }

  async create(data: Partial<IEntity>): Promise<IEntity> {
    const entity = new this.model(data);
    return await entity.save();
  }

  async findById(id: string): Promise<IEntity | null> {
    const query = this.model.findById(id);
    return await query.exec();
  }

  async findByIdentification(identification: string): Promise<IEntity | null> {
    const query = Entity.findOne({ 'generalInformation.identificationNumber': identification });
    return await query.exec();
  }

  async findAll(
    filters: any = {},
    limit: number = 10,
    skip: number = 0
  ): Promise<IEntity[]> {
    const query = this.model.find({ ...filters, deleted_at: null });
    return await query.limit(limit).skip(skip).exec();
  }

  async update(id: string, data: Partial<IEntity>): Promise<IEntity | null> {
    return await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<IEntity | null> {
    return await this.model
      .findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true })
      .exec();
  }

  async updateStateClientAmountReceivable(id:string, amountReceivable: mongoose.Types.Decimal128, session: mongoose.mongo.ClientSession): Promise<IEntity | null> {

    let entidad = await this.model.findByIdAndUpdate(
      id,
      { $inc: { amountReceivable: +amountReceivable } },
      { new: true, session }
    );

    return entidad;
  }

  async updateStateClientAmountPayable(id:string, amountPayable: mongoose.Types.Decimal128, session: mongoose.mongo.ClientSession): Promise<IEntity | null> {

    let entidad = await this.model.findByIdAndUpdate(
      id,
      { $inc: { amountPayable: +amountPayable } },
      { new: true, session }
    );

    return entidad;
  }

  async updateStateClientAdvancesDelivered(id:string, advancesDelivered: mongoose.Types.Decimal128, session: mongoose.mongo.ClientSession): Promise<IEntity | null> {

    let entidad = await this.model.findByIdAndUpdate(
      id,
      { $inc: { advancesDelivered: +advancesDelivered } },
      { new: true, session }
    );

    return entidad;
  }

  async updateStateClientAdvancesReceipts(id:string, advancesReceipts: mongoose.Types.Decimal128, session: mongoose.mongo.ClientSession): Promise<IEntity | null> {

    let entidad = await this.model.findByIdAndUpdate(
      id,
      { $inc: { advancesReceipts: +advancesReceipts } },
      { new: true, session }
    );

    return entidad;
  }
}
