import { RoleController } from '../../controllers/security/RoleController';
import { container } from 'tsyringe';
import { authMiddleware } from '../../middlewares/authMiddleware';

const express = require('express');
const router = express.Router();

const roleController = container.resolve(RoleController);

router.use(authMiddleware);

// Definir las rutas
router.post('/', roleController.create.bind(roleController));
router.get(
  '/:id',
  authMiddleware,
  roleController.getById.bind(roleController)
);
router.get('/', authMiddleware, roleController.getAll.bind(roleController));
router.put(
  '/:id',
  authMiddleware,
  roleController.update.bind(roleController)
);
router.delete(
  '/:id',
  authMiddleware,
  roleController.delete.bind(roleController)
);


export default router;
