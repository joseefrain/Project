
import { injectable, inject } from 'tsyringe';
import { ISucursal } from '../../models/sucursales/Sucursal.model';
import { SucursalRepository } from '../../repositories/sucursal/sucursal.repository';
import { IBranchProducts } from '../../models/inventario/Producto.model';
import { IInventarioSucursal } from '../../models/inventario/InventarioSucursal.model';

@injectable()
export class SucursalService {
  constructor(
    @inject(SucursalRepository) private repository: SucursalRepository
  ) {}

  async createSucursal(data: Partial<ISucursal>): Promise<ISucursal> {
    const branchExists = await this.repository.findByName(data.nombre!);

    if (branchExists) {
      throw new Error('branch already exists');
    }

    const newBranch = await this.repository.create(data);

    return newBranch;
  }

  async getBranchById(id: string): Promise<ISucursal | null> {
    const branch = await this.repository.findById(id);
    if (!branch) {
      throw new Error('Branch not found');
    }
    return branch;
  }

  async getAllBranch(
    filters: any,
    limit: number,
    skip: number
  ): Promise<ISucursal[]> {
    return this.repository.findAll(filters, limit, skip);
  }

  async findBranchProducts (id: string): Promise<IBranchProducts[]> {
    return this.repository.findBranchProducts(id);
  }

  async updateBranch(
    id: string,
    data: Partial<ISucursal>
  ): Promise<ISucursal | null> {
    const branch = await this.repository.update(id, data);
    if (!branch) {
      throw new Error('Branch not found');
    }
    return branch;
  }

  async deleteBranch(id: string): Promise<ISucursal | null> {
    const branch = await this.repository.delete(id);
    if (!branch) {
      throw new Error('Branch not found');
    }
    return branch;
  }

  async restoreBranch(id: string): Promise<ISucursal | null> {
    return this.repository.restore(id);
  }

  async searchForStockProductsAtBranch(branchId: string): Promise<IInventarioSucursal[]> {
    return this.repository.searchForStockProductsAtBranch(branchId);
  }
}
