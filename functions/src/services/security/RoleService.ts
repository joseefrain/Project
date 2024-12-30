
import { injectable, inject } from 'tsyringe';
import { IRole } from '../../models/security/Role.model';
import { RoleRepository } from '../../repositories/security/RoleRepository';

@injectable()
export class RoleService {
  constructor(
    @inject(RoleRepository) private repository: RoleRepository
  ) {}

  async createRole(data: Partial<IRole>): Promise<IRole | null> {
    const roleExists = await this.repository.findByName(data.name!);

    if (roleExists) {
      throw new Error('role already exists');
    }

    const newRole = await this.repository.create(data);

    return newRole;
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
