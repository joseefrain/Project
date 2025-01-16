import { injectable } from 'tsyringe';
import { IRole, Role } from '../../models/security/Role.model';
import mongoose, { DeleteResult } from 'mongoose';
import { User } from '../../models/usuarios/User.model';

@injectable()
export class RoleRepository {
  private model: typeof Role;
  private userModel: typeof User;

  constructor() {
    this.model = Role;
    this.userModel = User;
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

  async findRootRole(ids: string[]): Promise<IRole | null> {
    const query = this.model.findOne({ _id: { $in: ids }, name: 'root' });
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

  async delete(id: string): Promise<DeleteResult> {
    let role = await this.model.deleteOne({ _id: id }).exec();

    return role;
  }

  async isIdReferenced(roleId: string): Promise<boolean> {
    try {

      if (!mongoose.Types.ObjectId.isValid(roleId)) {
        throw new Error('El ID proporcionado no es válido');
      }

      // Verificar si hay un documento que use el _id en el campo 'author'
      const isReferenced = await this.userModel.exists({ roles: roleId });
      
      return isReferenced ? true : false; // Retorna true si se encuentra una referencia
    } catch (error) {
      console.error('Error verificando la referencia:', error);
      throw new Error('Ocurrió un error al verificar la referencia');
    }
  };
}
