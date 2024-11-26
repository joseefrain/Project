import { container } from 'tsyringe';
import { EntityController } from '../../controllers/entidades/Entity.controller';
import { authMiddleware } from '../../middlewares/authMiddleware';

const express = require('express');
const router = express.Router();

const entityController = container.resolve(EntityController);

// Definir las rutas
router.post('/', entityController.create.bind(entityController));

router.get(
  '/:id',
  authMiddleware,
  entityController.getById.bind(entityController)
);

router.get('/', entityController.getAll.bind(entityController));

router.put(
  '/:id',
  authMiddleware,
  entityController.update.bind(entityController)
);

router.delete(
  '/:id',
  authMiddleware,
  entityController.delete.bind(entityController)
);

export default router;
