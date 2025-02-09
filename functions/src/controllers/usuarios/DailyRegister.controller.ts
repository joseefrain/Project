import { Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { DailyRegisterService } from '../../services/user/DailyRegister.service';
import { formaterInManageTimezone } from '../../utils/date';

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
        startDate as string,
        endDate as string
      );
      
      res.json(registers);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async updateWorkingHours(req: Request, res: Response) {
    try {
      const { sucursalId, startWork, endWork } = req.body;
      
      if (!sucursalId) {
        throw new Error('Se requiere el ID de la sucursal');
      }

      if (!startWork || !endWork) {
        throw new Error('Se requiere el inicio y el final de la hora de trabajo');
      }

      let endDate2 = new Date(endWork)
      let startDate2 = new Date(startWork)

      const startDate = new Date(startDate2.setHours(startDate2.getHours() - 6));
      const endDate = new Date(endDate2.setHours(endDate2.getHours() - 6));

      if (!startDate || !endDate) {
        throw new Error('La fecha de inicio y la de fin no pueden ser nulas');
      }

      const result = await this.service.updateWorkingHours(sucursalId, startDate, endDate);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
}