import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { CoinService } from '../../services/transaction/coin.service';

@injectable()
export class CoinController {
  constructor(@inject(CoinService) private service: CoinService) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await this.service.createCoin(req.body);
      res.status(201).json(branch);
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
      const branch = await this.service.getCoinById(req.params.id);
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 50, skip = 0, ...filters } = req.query;
      const branch = await this.service.getAllCoins(
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
      const branch = await this.service.modifyCoin(req.params.id, req.body);
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await this.service.deleteCoin(req.params.id);
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }
}
