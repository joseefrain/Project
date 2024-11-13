import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { CashRegisterService } from 'src/services/utils/cashRegister.service';

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

  async getBySucursalId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const descuento = await this.service.obtenerCajasPorSucursal(id);
      res.status(200).json(descuento);
    } catch (error) {
      next(error);
    }
  }
}
