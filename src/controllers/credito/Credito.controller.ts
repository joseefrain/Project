import { NextFunction, Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { CreditoService } from '../../services/credito/Credito.service';
import mongoose from 'mongoose';

@injectable()
export class CreditoController {
  constructor(@inject(CreditoService) private service: CreditoService) {}

  async getById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const entity = await this.service.findCreditoById(req.params.id);
      res.status(200).json(entity);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entities = await this.service.findAllCreditos(req.params.entidadId);
      res.status(200).json(entities);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entity = await this.service.updateCredito(req.params.id, req.body);
      res.status(200).json(entity);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entity = await this.service.deleteCredito(req.params.id);
      res.status(200).json(entity);
    } catch (error) {
      next(error);
    }
  }

  async realizarPago(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let creditoId = new mongoose.Types.ObjectId(req.params.id);
      const entity = await this.service.realizarPago(creditoId, req.body.monto);
      res.status(200).json(entity);
    } catch (error) {
      next(error);
    }
  }

  async realizarPagoPlazo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let creditoId = new mongoose.Types.ObjectId(req.params.id);
      const entity = await this.service.realizarPagoPlazo(creditoId, req.body.monto);
      res.status(200).json(entity);
    } catch (error) {
      next(error);
    }
  }
}
