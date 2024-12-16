import { injectable, inject } from 'tsyringe';
import { IGrupoInventario, IGrupoInventarioWithPopulate } from '../../models/inventario/GrupoInventario.model';
import { GrupoInventarioRepository } from '../../repositories/inventary/GrupoInventario.repository';

@injectable()
export class GrupoInventarioService {
  constructor(
    @inject(GrupoInventarioRepository) private repository: GrupoInventarioRepository
  ) {}

  async createGrupo(data: Partial<IGrupoInventario>): Promise<IGrupoInventario> {
    const grupoExists = await this.repository.findByName(data.nombre!);

    if (grupoExists) {
      throw new Error('Grupo already exists');
    }

    const newGroup = await this.repository.create(data);

    return newGroup;
  }

  async getGroupById(id: string): Promise<IGrupoInventario | null> {
    const group = await this.repository.findById(id);
    if (!group) {
      throw new Error('Grupo not found');
    }
    return group;
  }

  async getAllGroups(
    filters: any,
    limit: number,
    skip: number
  ): Promise<IGrupoInventario[]> {
    return this.repository.findAll(filters, limit, skip);
  }

  async updateGroup(
    id: string,
    data: Partial<IGrupoInventario>
  ): Promise<IGrupoInventario | null> {
    const group = await this.repository.update(id, data);
    if (!group) {
      throw new Error('Grupo not found');
    }
    return group;
  }

  async deleteGroup(id: string): Promise<IGrupoInventario | null> {
    const group = await this.repository.delete(id);
    if (!group) {
      throw new Error('Group not found');
    }
    return group;
  }

  async restoreGroup(id: string): Promise<IGrupoInventario | null> {
    return this.repository.restore(id);
  }

  async findByIdWithProduct(id: string): Promise<IGrupoInventarioWithPopulate | null> {
    return await this.repository.findByIdWithProduct(id);
  }
  async findByIdWithProductBySucursalId(id: string, sucursalId: string): Promise<IGrupoInventarioWithPopulate | null> {
    return await this.repository.findByIdWithProductBySucursalId(id, sucursalId);
  }
}
