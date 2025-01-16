import { container } from 'tsyringe';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { CoinController } from '../../controllers/transaction/Coin.controller';

const express = require('express');
const router = express.Router();

const coinController = container.resolve(CoinController);

router.use(authMiddleware);

// Definir las rutas
router.post('/', coinController.create.bind(coinController));
router.get(
  '/:id',
  authMiddleware,
  coinController.getById.bind(coinController)
);
router.get('/', authMiddleware, coinController.getAll.bind(coinController));
router.put(
  '/:id',
  authMiddleware,
  coinController.update.bind(coinController)
);
router.delete(
  '/:id',
  authMiddleware,
  coinController.delete.bind(coinController)
);


export default router;
