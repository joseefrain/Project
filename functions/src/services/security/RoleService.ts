
import { injectable, inject } from 'tsyringe';
import { IRole } from '../../models/security/Role.model';
import { RoleRepository } from '../../repositories/security/RoleRepository';
import { UserRepository } from '../../repositories/user/User.repository';
import mongoose, { mongo } from 'mongoose';
import { IUser } from '../../models/usuarios/User.model';

@injectable()
export class RoleService {
  constructor(
    @inject(RoleRepository) private repository: RoleRepository,
    @inject(UserRepository) private userRepository: UserRepository
  ) {}

  async createRole(data: Partial<IRole>): Promise<IRole | null> {
    const roleExists = await this.repository.findByName(data.name!);

    if (roleExists) {
      throw new Error('role already exists');
    }

    const newRole = await this.repository.create(data);

    return newRole;
  }

  async addSingleRoleToUser(userId: string, roleId: string): Promise<IUser | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('user not found');
    }

    const role = await this.repository.findById(roleId);
    if (!role) {
      throw new Error('role not found');
    }

    (user.roles as mongoose.Types.ObjectId[]).push(role._id as mongoose.Types.ObjectId);

    return await this.userRepository.update(userId, user);
  }

  async addMultipleRolesToUser(userId: string, rolesId: string[]): Promise<IUser | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('user not found');
    }

    const roles = await this.repository.findListByIds(rolesId);

    for (const role of roles) {
      if (!role) {
        throw new Error('role not found');
      }

      (user.roles as mongoose.Types.ObjectId[]).push(role._id as mongoose.Types.ObjectId);
    }

    return await this.userRepository.update(userId, user);
  }

  async getRoleById(id: string): Promise<IRole | null> {
    const role = await this.repository.findById(id);
    if (!role) {
      throw new Error('role not found');
    }
    return role;
  }

  async getAllRole(
    filters: any,
    limit: number,
    skip: number
  ): Promise<IRole[]> {
    return this.repository.findAll(filters, limit, skip);
  }

  async updateRole(
    id: string,
    data: Partial<IRole>
  ): Promise<IRole | null> {
    const role = await this.repository.update(id, data);
    if (!role) {
      throw new Error('role not found');
    }
    return role;
  }

  async deleteRole(id: string): Promise<IRole | null> {
    const role = await this.repository.delete(id);
    if (!role) {
      throw new Error('role not found');
    }
    return role;
  }
}
