import { inject, injectable } from 'tsyringe';
import { IClientState, IEntity } from '../../models/entity/Entity.model';
import { EntityRepository } from '../../repositories/entity/Entity.repository';
import mongoose from 'mongoose';

@injectable()
export class EntityService {
  constructor(@inject(EntityRepository) private repository: EntityRepository) {}

  async createEntity(data: Partial<IEntity>): Promise<IEntity> {
    const entityExists = await this.repository.findByIdentification(
      data.generalInformation?.identificationNumber!
    );

    if (entityExists) {
      throw new Error('Entity already exists');
    }

    let state:IClientState = {
      amountReceivable: new mongoose.Types.Decimal128('0'),
      advancesReceipts: new mongoose.Types.Decimal128('0'),
      advancesDelivered: new mongoose.Types.Decimal128('0'),
      amountPayable: new mongoose.Types.Decimal128('0'),
    }

    data.state = state;

    const newEntity = await this.repository.create(data);
    return newEntity;
  }

  async getEntityById(id: string): Promise<IEntity | null> {
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new Error('Entity not found');
    }
    return entity;
  }

  async getAllEntities(
    filters: any,
    limit: number,
    skip: number
  ): Promise<IEntity[]> {
    return this.repository.findAll(filters, limit, skip);
  }

  async updateEntity(
    id: string,
    data: Partial<IEntity>
  ): Promise<IEntity | null> {
    const entity = await this.repository.update(id, data);
    if (!entity) {
      throw new Error('Entity not found');
    }
    return entity;
  }

  async deleteEntity(id: string): Promise<IEntity | null> {
    const entity = await this.repository.delete(id);
    if (!entity) {
      throw new Error('Entity not found');
    }
    return entity;
  }
}
