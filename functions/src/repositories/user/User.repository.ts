import { injectable } from 'tsyringe';
import { IUser, ROL, User } from '../../models/usuarios/User.model';
import { Sucursal } from '../../models/sucursales/Sucursal.model';
import { getDateInManaguaTimezone } from '../../utils/date';

@injectable()
export class UserRepository {
  private model: typeof User;

  constructor() {
    this.model = User;
  }

  async create(data: Partial<IUser>): Promise<IUser> {
    const user = new this.model(data);
    return await user.save();
  }

  async findById(id: string): Promise<IUser | null> {
    const query = this.model.findById(id);

    query.populate(["sucursalId", "roles"]);

    return await query.exec();
  }

  async findByUsername(username: string): Promise<IUser | null> {
    const query = this.model.findOne({ username });

    query.populate(["sucursalId", "roles"]);

    return await query.exec();
  }

  async findAll(
    filters: any = {},
    limit: number = 10,
    skip: number = 0
  ): Promise<IUser[]> {
    const users = await this.model.find({ ...filters, deleted_at: null }).populate(["sucursalId", "roles"]);

    return users
  }

  async update(id: string, data: Partial<IUser>): Promise<IUser | null> {
    return await this.model.findByIdAndUpdate(id, data, { new: true }).populate(["sucursalId", "roles"]).exec();
  }

  async delete(id: string): Promise<IUser | null> {
    return await this.model
      .findByIdAndUpdate(id, { deleted_at: getDateInManaguaTimezone() }, { new: true })
      .exec();
  }

  async restore(id: string): Promise<IUser | null> {
    return await this.model
      .findByIdAndUpdate(id, { deleted_at: null }, { new: true })
      .exec();
  }
  async findByRole(role: ROL): Promise<IUser | null> {
    const query = this.model.findOne({ role });

    return await query.exec();
  }
}
