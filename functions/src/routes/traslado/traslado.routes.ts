import { TrasladoController } from '../../controllers/traslado/traslado.controller';
import { container } from 'tsyringe';
import { authMiddleware } from '../../middlewares/authMiddleware';

const express = require('express');
const router = express.Router();

const trasladoController = container.resolve(TrasladoController);

router.use(authMiddleware);

// Post de envio de pedido
router.post(
  '/',
  trasladoController.postCreateEnvioProducto.bind(trasladoController)
);
router.post(
  '/RecibirPedido',
  trasladoController.postCreateRecibirProducto.bind(trasladoController)
);

// Get de pedidos enviados
router.get(
  '/:id/enviados',
  trasladoController.findPedidoEnviadosBySucursal.bind(trasladoController)
);

// Get de pedidos recibidos
router.get(
  '/:id/recibidos',
  trasladoController.findPedidoRecibidosBySucursal.bind(trasladoController)
);

// Get de pedidos por recibir
router.get(
  '/recibir/:id',
  trasladoController.findPedidoPorRecibirBySucursal.bind(trasladoController)
);

// Get de pedido por id con item de pedido
router.get(
  '/:id/itemdepedido',
  trasladoController.findPedidoByIdWithItemDePedido.bind(trasladoController)
);

router.get('/:id/devolver-producto', trasladoController.returnProductToBranch.bind(trasladoController));

export default router;
