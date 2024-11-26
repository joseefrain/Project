import { injectable } from 'tsyringe';
import { Entity, IEntity } from '../../models/entity/Entity.model';

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
    const query = this.model.findOne({ identificationNumber: identification });
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
}
