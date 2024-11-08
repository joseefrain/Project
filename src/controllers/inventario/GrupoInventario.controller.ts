import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { GrupoInventarioService } from '../../services/inventario/GrupoInventario.service';

@injectable()
export class GrupoInventarioController {
  constructor(@inject(GrupoInventarioService) private service: GrupoInventarioService) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const group = await this.service.createGrupo(req.body);
      res.status(201).json(group);
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
      const group = await this.service.getGroupById(req.params.id);
      res.status(200).json(group);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 10, skip = 0, ...filters } = req.query;
      const group = await this.service.getAllGroups(
        filters,
        Number(limit),
        Number(skip)
      );
      res.status(200).json(group);
    } catch (error) {
      next(error);
    }
  }

  async findByIdWithProduct(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const group = await this.service.findByIdWithProduct(
        req.params.id
      )

      res.status(200).json(group);
    } catch (error) {
      next(error);
    }
  }

  async findByIdWithProductBySucursalId(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const group = await this.service.findByIdWithProductBySucursalId(
        req.params.id,
        req.params.sucursalId
      )

      res.status(200).json(group);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const group = await this.service.updateGroup(req.params.id, req.body);
      res.status(200).json(group);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const group = await this.service.deleteGroup(req.params.id);
      res.status(200).json(group);
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
      const group = await this.service.restoreGroup(req.params.id);
      res.status(200).json(group);
    } catch (error) {
      next(error);
    }
  }
}
