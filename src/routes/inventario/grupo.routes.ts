import { GrupoInventarioController } from '../../controllers/inventario/GrupoInventario.controller';
import { container } from 'tsyringe';
import { authMiddleware } from '../../middlewares/authMiddleware';

const express = require('express');
const router = express.Router();

const groupController = container.resolve(GrupoInventarioController);

router.use(authMiddleware);

// Definir las rutas
router.post('/', groupController.create.bind(groupController));
router.get(
  '/:id/products',
  authMiddleware,
  groupController.findByIdWithProduct.bind(groupController)
);
router.get('/:id/products/:sucursalId', authMiddleware, groupController.findByIdWithProductBySucursalId.bind(groupController));
router.get(
  '/:id',
  authMiddleware,
  groupController.getById.bind(groupController)
);
router.get('/', authMiddleware, groupController.getAll.bind(groupController));
router.put(
  '/:id',
  authMiddleware,
  groupController.update.bind(groupController)
);
router.delete(
  '/:id',
  authMiddleware,
  groupController.delete.bind(groupController)
);
router.patch(
  '/:id/restore',
  authMiddleware,
  groupController.restore.bind(groupController)
);

export default router;
