import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { UserService } from '../../services/user/User.service';
import { CashRegisterService } from '../../services/utils/cashRegister.service';
import { Types } from 'mongoose';
import { ICaja } from '../../models/cashRegister/CashRegister.model';
import { ROL } from '../../models/usuarios/User.model';

@injectable()
export class UserController {
  constructor(
    @inject(UserService) private service: UserService,
    @inject(CashRegisterService) private cashRegisterService: CashRegisterService
  ) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = await this.service.createUser(req.body);
      res.status(201).json(token);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = await this.service.loginUser(req.body);

      let role = token.user.role;

      let cajaId: ICaja | null = null;

      if (req.isMobile && role !== ROL.ROOT) {
        throw new Error("No se puede acceder desde un dispositivo móvil"); 
      }

      if(role !== "ROOT") cajaId = await this.cashRegisterService.obtenerCajasAbiertasPorUsuario((token.user._id as Types.ObjectId).toString());
      
      res.status(200).json({ ...token, cajaId });
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
      const user = await this.service.getUserById(req.params.id);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 10, skip = 0, ...filters } = req.query;
      const users = await this.service.getAllUsers(
        filters,
        Number(limit),
        Number(skip)
      );
      res.status(200).json(users);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await this.service.updateUser(req.params.id, req.body);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await this.service.deleteUser(req.params.id);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }

  async restore(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await this.service.restoreUser(req.params.id);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }
}
