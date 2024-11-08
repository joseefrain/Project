import { DescuentoController } from '../../controllers/venta/Descuento.controller';
import { container } from 'tsyringe';
import { authMiddleware } from '../../middlewares/authMiddleware';

const express = require('express');
const router = express.Router();

const descuentoController = container.resolve(DescuentoController);

router.use(authMiddleware);

// Definir las rutas
router.post(
  '/',
  authMiddleware,
  descuentoController.create.bind(descuentoController)
);
router.get('/', authMiddleware, descuentoController.getAll.bind(descuentoController));
router.get(
  '/:id/branch',
  authMiddleware,
  descuentoController.getBySucursalId.bind(descuentoController)
);
router.get(
  '/:id',
  authMiddleware,
  descuentoController.getById.bind(descuentoController)
);
router.put(
  '/:id',
  authMiddleware,
  descuentoController.update.bind(descuentoController)
);
router.delete(
  '/:id',
  authMiddleware,
  descuentoController.delete.bind(descuentoController)
);
router.patch(
  '/:id/restore',
  authMiddleware,
  descuentoController.restore.bind(descuentoController)
);

export default router;
