import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { ICreateVentaProps, VentaService } from '../../services/venta/venta.service';
import { CustomJwtPayload } from '../../utils/jwt';
import mongoose from 'mongoose';

@injectable()
export class VentaController {
  constructor(@inject(VentaService) private service: VentaService) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let data: ICreateVentaProps = {
        venta: req.body,
        user: (req.user as CustomJwtPayload)
      }
      const venta = await this.service.addSaleToQueue(data);
      res.status(201).json(venta);
    } catch (error) {
      next(error);
    }
  }

  async getBySucursalId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ventas = await this.service.getVentasBySucursal(req.params.id);
      res.status(200).json(ventas);
    } catch (error) {
      next(error);
    }
  }
  async getVentaById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const venta = await this.service.getVentaById(req.params.id);
      res.status(200).json(venta);
    } catch (error) {
      next(error);
    }
  }
  async findAllVentaBySucursalIdAndUserId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ventas = await this.service.findAllVentaBySucursalIdAndUserId(req.params.id, ((req.user as CustomJwtPayload).id as mongoose.Types.ObjectId).toString());
      res.status(200).json(ventas);
    } catch (error) {
      next(error);
    }
  }
}
