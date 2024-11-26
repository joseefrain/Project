import { NextFunction, Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { EntityService } from '../../services/entity/Entity.service';

@injectable()
export class EntityController {
  constructor(@inject(EntityService) private service: EntityService) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entity = await this.service.createEntity(req.body);
      res.status(201).json(entity);
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
      const entity = await this.service.getEntityById(req.params.id);
      res.status(200).json(entity);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 10, skip = 0, ...filters } = req.query;
      const entities = await this.service.getAllEntities(
        filters,
        Number(limit),
        Number(skip)
      );
      res.status(200).json(entities);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entity = await this.service.updateEntity(req.params.id, req.body);
      res.status(200).json(entity);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entity = await this.service.deleteEntity(req.params.id);
      res.status(200).json(entity);
    } catch (error) {
      next(error);
    }
  }
}
