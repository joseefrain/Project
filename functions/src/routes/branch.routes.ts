import { SucursalController } from '../controllers/sucursal/Sucursal.controller';
import { container } from 'tsyringe';
import { authMiddleware } from '../middlewares/authMiddleware';

const express = require('express');
const router = express.Router();

const branchController = container.resolve(SucursalController);

router.use(authMiddleware);

// Definir las rutas
router.post('/', branchController.create.bind(branchController));
router.get(
  '/:id',
  authMiddleware,
  branchController.getById.bind(branchController)
);
router.get('/', authMiddleware, branchController.getAll.bind(branchController));
router.put(
  '/:id',
  authMiddleware,
  branchController.update.bind(branchController)
);
router.delete(
  '/:id',
  authMiddleware,
  branchController.delete.bind(branchController)
);
router.patch(
  '/:id/restore',
  authMiddleware,
  branchController.restore.bind(branchController)
);

router.get('/:id/products', authMiddleware, branchController.findBranchProducts.bind(branchController));
router.get('/:id/products-shortages', authMiddleware, branchController.searchForStockProductsAtBranch.bind(branchController));

export default router;
