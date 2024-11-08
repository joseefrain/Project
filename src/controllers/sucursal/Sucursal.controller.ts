import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { SucursalService } from '../../services/sucursal/Sucursal.service';

@injectable()
export class SucursalController {
  constructor(@inject(SucursalService) private service: SucursalService) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await this.service.createSucursal(req.body);
      res.status(201).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async getById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const branch = await this.service.getBranchById(req.params.id);
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 50, skip = 0, ...filters } = req.query;
      const branch = await this.service.getAllBranch(
        filters,
        Number(limit),
        Number(skip)
      );
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async findBranchProducts(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const branch = await this.service.findBranchProducts(req.params.id);
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await this.service.updateBranch(req.params.id, req.body);
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await this.service.deleteBranch(req.params.id);
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async restore(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const branch = await this.service.restoreBranch(req.params.id);
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async searchForStockProductsAtBranch(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const product = await this.service.searchForStockProductsAtBranch(
        req.params.id
      );
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  }
}
