import { UserController } from '../controllers/usuarios/User.controller';
import { container } from 'tsyringe';
import { authMiddleware } from '../middlewares/authMiddleware';

const express = require('express');
const router = express.Router();

const usersController = container.resolve(UserController);

// Definir las rutas
router.post('/', usersController.create.bind(usersController));
router.post('/login', usersController.login.bind(usersController));
router.get(
  '/:id',
  authMiddleware,
  usersController.getById.bind(usersController)
);
router.get('/', usersController.getAll.bind(usersController));
router.put(
  '/:id',
  authMiddleware,
  usersController.update.bind(usersController)
);
router.delete(
  '/:id',
  authMiddleware,
  usersController.delete.bind(usersController)
);
router.patch(
  '/:id/restore',
  authMiddleware,
  usersController.restore.bind(usersController)
);

export default router;
