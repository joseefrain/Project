import { container } from 'tsyringe';
import { authMiddleware } from '../middlewares/authMiddleware';
import { DashboardController } from '../controllers/dashboard.controller';

const express = require('express');
const router = express.Router();

const dashboardController = container.resolve(DashboardController);

// router.use(authMiddleware);

// Definir las rutas
router.get('/product-metrics/:sucursalId', dashboardController.getTransactionMetrics.bind(dashboardController));

export default router;
