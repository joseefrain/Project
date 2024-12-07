import { container } from 'tsyringe';
import { CreditoController } from '../../controllers/credito/Credito.controller';
import { authMiddleware } from '../../middlewares/authMiddleware';

const express = require('express');
const router = express.Router();

const creditoController = container.resolve(CreditoController);

// Definir las rutas
router.post('/realizarPago', creditoController.realizarPago.bind(creditoController));
router.post('/realizarPagoPlazo', creditoController.realizarPagoPlazo.bind(creditoController));

router.get(
  '/:id',
  authMiddleware,
  creditoController.getById.bind(creditoController)
);

router.get('/byEntity/:entidadId', creditoController.getAll.bind(creditoController));

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
