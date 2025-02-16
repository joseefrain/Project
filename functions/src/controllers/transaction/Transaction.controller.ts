import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { ICreateTransactionProps, TransactionService } from '../../services/transaction/transaction.service';
import { CustomJwtPayload } from '../../utils/jwt';
import mongoose from 'mongoose';
import { TypePaymentMethod, TypeTransaction } from '../../models/transaction/Transaction.model';
import { TypeEstatusTransaction } from '../../interface/ICaja';

@injectable()
export class TransactionController {
  constructor(@inject(TransactionService) private service: TransactionService) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let data: ICreateTransactionProps = {
        venta: req.body,
        user: (req.user as CustomJwtPayload),
      }
      const result = await this.service.addTransactionToQueue(data);
      res.status(201).json(result); // Enviar el resultado
    } catch (error) {
      next(error);
    }
  }

  async descuento(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.service.createDevolucion(req.body);
      res.status(201).json(result); // Enviar el resultado
    } catch (error) {
      next(error);
    }
  }

  async getVentasBySucursal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ventas = await this.service.findByTypeAndBranch(req.params.id, TypeTransaction.VENTA);
      res.status(200).json(ventas);
    } catch (error) {
      console.log(error.message);
      
      next(error);
    }
  }

  async getComprasBySucursal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const compras = await this.service.findByTypeAndBranch(req.params.id, TypeTransaction.COMPRA);
      res.status(200).json(compras);
    } catch (error) {
      console.log(error.message);
      
      next(error);
    }
  }

  async getDevolucionesBySucursal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let typeTransaction = req.params.typeTransaction as TypeTransaction;
      let id = req.params.id;
      const ventas = await this.service.findDevolucionesBySucursalId(id, typeTransaction);
      res.status(200).json(ventas);
    } catch (error) {
      console.log(error.message);
      
      next(error);
    }
  }

  async getReturnCreditBySucursal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let id = req.params.id;
      const ventas = await this.service.findReturnCreditBySucursal(id);
      res.status(200).json(ventas);
    } catch (error) {
      console.log(error.message);
      
      next(error);
    }
  }

  async findTransactionByCreditByBranch (req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let id = req.params.id;
      const ventas = await this.service.findTransactionByCreditByBranch(id);
      res.status(200).json(ventas);
    } catch (error) {
      next(error)
    }
  }

  async getTransactionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const venta = await this.service.getTransactionById(req.params.id);
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

  async getResumenDiarioByCashierId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const resumenDiario = await this.service.getResumenDiarioByCashierId(req.params.id);
      res.status(200).json(resumenDiario);
    } catch (error) {
      next(error);
    }
  }

  async findTransactionsByProductId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let estadoTrasaccion = req.params.estadoTrasaccion as TypeEstatusTransaction;
      const transactions = await this.service.findTransactionsByProductId(req.params.id, estadoTrasaccion);
      res.status(200).json(transactions);
    } catch (error) {
      next(error);
    }
  }
}
