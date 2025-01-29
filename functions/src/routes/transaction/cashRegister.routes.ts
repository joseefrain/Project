import { CashRegisterController } from '../../controllers/transaction/CashRegister.controller';
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

router.post('/create', authMiddleware, cashRegisterController.createCashRegister.bind(cashRegisterController));

router.post(
  '/',
  authMiddleware,
  cashRegisterController.openCashRegister.bind(cashRegisterController)
);
router.post(
  '/close',
  authMiddleware,
  cashRegisterController.closeCashRegister.bind(cashRegisterController)
);

router.get('/abiertas/:id', authMiddleware, cashRegisterController.obtenerCajasAbiertaPorSucursal.bind(cashRegisterController));
router.get('/cerradas/:id', authMiddleware, cashRegisterController.obtenerCajasCerradaPorSucursal.bind(cashRegisterController));

router.post('/userAndBranch', authMiddleware, cashRegisterController.obtenerCajasAbiertasPorUsuarioYSucursal.bind(cashRegisterController));


export default router;
