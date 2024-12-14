import { TransactionController } from '../../controllers/venta/Venta.controller';
import { container } from 'tsyringe';
import { authMiddleware } from '../../middlewares/authMiddleware';

const express = require('express');
const router = express.Router();

const transactionController = container.resolve(TransactionController);

router.use(authMiddleware);

// Definir las rutas
router.post(
  '/',
  authMiddleware,
  transactionController.create.bind(transactionController)
);
router.get(
  '/:id',
  authMiddleware,
  transactionController.getVentaById.bind(transactionController)
);

router.get(
  '/:id/branch',
  authMiddleware,
  transactionController.getBySucursalId.bind(transactionController)
);

router.get(
  '/:id/branch/user',
  authMiddleware,
  transactionController.findAllVentaBySucursalIdAndUserId.bind(transactionController)
);

// router.get('/', authMiddleware, ventaController.getAll.bind(ventaController));
// router.get(
//   '/:id/branch',
//   authMiddleware,
//   ventaController.getBySucursalId.bind(ventaController)
// );
// router.get(
//   '/:id',
//   authMiddleware,
//   ventaController.getById.bind(ventaController)
// );
// router.put(
//   '/:id',
//   authMiddleware,
//   ventaController.update.bind(ventaController)
// );
// router.delete(
//   '/:id',
//   authMiddleware,
//   ventaController.delete.bind(ventaController)
// );
// router.patch(
//   '/:id/restore',
//   authMiddleware,
//   ventaController.restore.bind(ventaController)
// );

export default router;
