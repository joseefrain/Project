import { container } from 'tsyringe';
import { CreditoController } from '../../controllers/credito/Credito.controller';
import { authMiddleware } from '../../middlewares/authMiddleware';

const express = require('express');
const router = express.Router();

const creditoController = container.resolve(CreditoController);

// Definir las rutas
router.post('/pagoCredito', authMiddleware, creditoController.handlePagoCredito.bind(creditoController));

router.get(
  '/:id',
  authMiddleware,
  creditoController.getById.bind(creditoController)
);

router.get('/byEntity/:entidadId', creditoController.getAllByEntity.bind(creditoController));

router.get('/bySucursalId/:sucursalId', creditoController.findCreditoBySucursalId.bind(creditoController));

router.put(
  '/:id',
  authMiddleware,
  creditoController.update.bind(creditoController)
);

router.delete(
  '/:id',
  authMiddleware,
  creditoController.delete.bind(creditoController)
);

export default router;
