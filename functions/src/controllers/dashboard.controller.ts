import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { DashboardServices } from '../services/utils/dashboar.service';

@injectable()
export class DashboardController {
  constructor(
    @inject(DashboardServices) private service: DashboardServices,
  ) {}

  async getTransactionMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sucursalId } = req.params;
      const metrics = await this.service.getTransactionMetrics(sucursalId);
      res.status(200).json(metrics);
    } catch (error) {
      next(error);
    }
  }
}
