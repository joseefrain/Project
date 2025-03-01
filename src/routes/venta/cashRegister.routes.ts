import { CashRegisterController } from '../../controllers/venta/CashRegister.controller';
import { container } from 'tsyringe';
import { authMiddleware } from '../../middlewares/authMiddleware';

const express = require('express');
const router = express.Router();

const cashRegisterController = container.resolve(CashRegisterController);

router.use(authMiddleware);

// Definir las rutas

router.get(
  '/:id/branch',
  authMiddleware,
  cashRegisterController.getBySucursalId.bind(cashRegisterController)
);
router.get(
  '/:id',
  authMiddleware,
  cashRegisterController.getById.bind(cashRegisterController)
);


export default router;
