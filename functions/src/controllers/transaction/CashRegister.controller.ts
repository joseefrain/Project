import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { CashRegisterService } from '../../services/utils/cashRegister.service';
import { CustomJwtPayload } from '../../utils/jwt';

@injectable()
export class CashRegisterController {
  constructor(@inject(CashRegisterService) private service: CashRegisterService) {}

  async getById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id;
      const descuento = await this.service.obtenerCajaPorId(id);
      res.status(200).json(descuento);
    } catch (error) {
      next(error);
    }
  }

  async createCashRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body;
      const caja = await this.service.createCaja(data);
      res.status(200).json(caja);
    } catch (error) {
      next(error);
    }
  }

  async getBySucursalId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const cashiers = await this.service.obtenerCajasPorSucursal(id);
      res.status(200).json(cashiers);
    } catch (error) {
      next(error);
    }
  }

  async obtenerCajasAbiertaPorSucursal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const cashiers = await this.service.obtenerCajasAbiertaPorSucursal(id);
      res.status(200).json(cashiers);
    } catch (error) {
      next(error);
    }
  }

  async obtenerCajasCerradaPorSucursal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const cashiers = await this.service.obtenerCajasCerradaPorSucursal(id);
      res.status(200).json(cashiers);
    } catch (error) {
      next(error);
    }
  }

  async openCashRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {

      const data = req.body;
      let userId = (req.user as CustomJwtPayload).id.toString();
      data.userId = userId;
      const caja = await this.service.abrirCaja(data);
      res.status(200).json(caja);
    } catch (error) {
      next(error);
    }
  }

  async closeCashRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body;
      let userId = (req.user as CustomJwtPayload).id.toString();
      data.usuarioArqueoId = userId;
      const caja = await this.service.cerrarCaja(data);
      res.status(200).json(caja);
    } catch (error) {
      next(error);
    }
  }

  async obtenerCajasAbiertasPorUsuarioYSucursal (req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usuarioId = req.body.usuarioId;
      const sucursalId = req.body.sucursalId;

      const cajas = await this.service.obtenerCajasAbiertasPorUsuarioYSucursal(usuarioId, sucursalId);
      res.status(200).json(cajas);
    } catch (error) {
      next(error);
    }
  }

  async findDailyCashierByCajaId(req: Request, res: Response, next: NextFunction) {
    try {
      const cajaId = req.params.cajaId;
      const limit = parseInt(req.params.limit);
      const skip = parseInt(req.params.skip);

      const cajas = await this.service.findDailyCashierByCajaId(cajaId, limit, skip);
      res.status(200).json(cajas);
    } catch (error) {
      next(error);
    }
  }
}
