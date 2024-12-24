import { NextFunction, Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { CreditoService } from '../../services/credito/Credito.service';
import mongoose from 'mongoose';
import { CustomJwtPayload } from '../../utils/jwt';

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

  async handlePagoCredito(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let montoPago = `${req.body.montoPago}`;
      let userId = (req.user as CustomJwtPayload).id.toString();
      let creditoId = req.body.creditoIdStr;
      let modalidadCredito = req.body.modalidadCredito;
      let cajaId = req.body.cajaId;

      const data = {
        creditoIdStr: creditoId,
        montoPago: montoPago,
        modalidadCredito: modalidadCredito,
        userId: userId,
        cajaId: cajaId,
      }
      const credito = await this.service.handlePagoCredito(data);
      res.status(200).json(credito);
    } catch (error) {
      next(error);
    }
  }
}
