import { Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { DailyRegisterService } from '../../services/user/DailyRegister.service';

@injectable()
export class DailyRegisterController {
  constructor(
    @inject(DailyRegisterService) private service: DailyRegisterService
  ) {}

  async create(req: Request, res: Response) {
    try {
      const register = await this.service.createDailyRegister(req.body);
      res.status(201).json(register);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const register = await this.service.getDailyRegisterById(req.params.id);
      res.json(register);
    } catch (error) {
      res.status(404).json({ error: (error as Error).message });
    }
  }

  async getByUser(req: Request, res: Response) {
    try {
      const registers = await this.service.getUserRegisters(req.params.userId);
      res.json(registers);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const register = await this.service.updateDailyRegister(
        req.params.id,
        req.body
      );
      res.json(register);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      await this.service.deleteDailyRegister(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async restore(req: Request, res: Response) {
    try {
      await this.service.restoreDailyRegister(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async markExit(req: Request, res: Response) {
    try {
      const register = await this.service.markExit(req.params.userId);
      res.json(register);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getBySucursal(req: Request, res: Response) {
    try {
      const { sucursalId } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        throw new Error('Se requieren ambas fechas');
      }

      const registers = await this.service.getBySucursalAndDateRange(
        sucursalId,
        new Date(startDate as string),
        new Date(endDate as string)
      );
      
      res.json(registers);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
}