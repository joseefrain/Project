import { injectable } from 'tsyringe';
import { IRole, Role } from '../../models/security/Role.model';

@injectable()
export class RoleRepository {
  private model: typeof Role;

  constructor() {
    this.model = Role;
  }

  async create(data: Partial<IRole>): Promise<IRole | null> {
    const entity = new this.model(data);
    await entity.save();
    return entity;
  }

  async findById(id: string): Promise<IRole | null> {
    const query = this.model.findById(id);
    return await query.exec();
  }

  async findListByIds(ids: string[]): Promise<IRole[]> {
    const query = this.model.find({ _id: { $in: ids } });
    return await query.exec();
  }

  async findByName(name: string): Promise<IRole | null> {
    const query = this.model.findOne({ name });

    return await query.exec();
  }

  async findAll(
    filters: any = {},
    limit: number = 10,
    skip: number = 0
  ): Promise<IRole[]> {
    const query = this.model.find({ ...filters, deleted_at: null });
    return await query.limit(limit).skip(skip).exec();
  }

  async update(id: string, data: Partial<IRole>): Promise<IRole | null> {
    return await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async updateWith(id: string, data: Partial<IRole>, ): Promise<IRole | null> {
    return await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<IRole | null> {
    return await this.model
      .findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true })
      .exec();
  }
}
