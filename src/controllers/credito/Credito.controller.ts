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

  async getAllByEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entities = await this.service.findAllCreditosByEntity(req.params.entidadId);
      res.status(200).json(entities);
    } catch (error) {
      next(error);
    }
  }

  async findCreditoBySucursalId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entities = await this.service.findCreditoBySucursalId(req.params.sucursalId);
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

  async handlePagoCredito(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const credito = await this.service.handlePagoCredito(req.body.creditoIdStr, req.body.montoPago, req.body.modalidadCredito);
      res.status(200).json(credito);
    } catch (error) {
      next(error);
    }
  }
}
