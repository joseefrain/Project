import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { RoleService } from '../../services/security/RoleService';

@injectable()
export class RoleController {
  constructor(@inject(RoleService) private service: RoleService) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await this.service.createRole(req.body);
      res.status(201).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async addSingleRoleToUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const branch = await this.service.addSingleRoleToUser(
        req.params.userId,
        req.params.roleId
      );
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }
  async addMultipleRolesToUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const branch = await this.service.addMultipleRolesToUser(
        req.params.userId,
        req.body.roles
      );
      res.status(200).json(branch);
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
      const branch = await this.service.getRoleById(req.params.id);
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 50, skip = 0, ...filters } = req.query;
      const branch = await this.service.getAllRole(
        filters,
        Number(limit),
        Number(skip)
      );
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await this.service.updateRole(req.params.id, req.body);
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await this.service.deleteRole(req.params.id);
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }
}
