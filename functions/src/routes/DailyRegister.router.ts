import express from 'express';
import { inject, injectable } from 'tsyringe';
import { DailyRegisterController } from '../controllers/usuarios/DailyRegister.controller';

@injectable()
export class DailyRegisterRouter {
  constructor(
    @inject(DailyRegisterController) private controller: DailyRegisterController
  ) {}

  getRouter() {
    const router = express.Router();

    router.post('/', this.controller.create.bind(this.controller));
    router.get('/:id', this.controller.getById.bind(this.controller));
    router.get('/user/:userId', this.controller.getByUser.bind(this.controller));
    router.put('/:id', this.controller.update.bind(this.controller));
    router.delete('/:id', this.controller.delete.bind(this.controller));
    router.post('/:id/restore', this.controller.restore.bind(this.controller));
    router.patch('/:userId/exit', this.controller.markExit.bind(this.controller));
    router.get('/sucursal/:sucursalId', this.controller.getBySucursal.bind(this.controller));

    return router;
  }
}