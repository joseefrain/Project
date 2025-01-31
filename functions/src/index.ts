import { ExpressAdapter } from '@bull-board/express';
import * as dotenv from 'dotenv';
import 'reflect-metadata';
import connectDB, { ensureDatabaseConnection } from './config/database';
import { errorHandler } from './middlewares/errorHandler';
import branchRoutes from './routes/branch.routes';
import entityRoutes from './routes/entity/entity.routes';
import grupoRoutes from './routes/inventario/grupo.routes';
import productRoutes from './routes/inventario/producto.routes';
import productTransfer from './routes/traslado/traslado.routes';
import userRoutes from './routes/user.routes';
import cashRegisterRoutes from './routes/transaction/cashRegister.routes';
import descuentos from './routes/transaction/descuento.routes';
import transaccionesRoutes from './routes/transaction/transaction.routes';
import creditoRoutes from './routes/credito/credito.routes';
import roleRoutes from './routes/security/RoleRouter';
import coinRoutes from './routes/transaction/coin.routes';
import dashboardRoutes from './routes/dashboaard.routes';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as functions from 'firebase-functions/v2';
import { Request, Response } from 'express';


const express = require('express');
const cors = require('cors');

dotenv.config();

const app = express();
const port = process.env.PORT;

connectDB();

app.use(helmet());

// Enable rate limit
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: true,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      statusCode: 429,
      body: {
        message: 'Se ha superado el límite permitido de solicitudes por minuto',
      },
    });
  },
});
// app.use(limiter);

app.use(cors());
app.use(ensureDatabaseConnection)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rutas
app.use('/api/entity', entityRoutes);
app.use('/api/users', userRoutes);
app.use('/api/branches', branchRoutes);

// rutas de inventario
app.use('/api/inventory/products', productRoutes);
app.use('/api/inventory/groups', grupoRoutes);

//rutas de transferencia
app.use('/api/transfer', productTransfer);

//rutas de venta
app.use('/api/transaccion/descuentos', descuentos);
app.use('/api/transaccion', transaccionesRoutes);
app.use('/api/cashRegister', cashRegisterRoutes);
app.use('/api/credito', creditoRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/coin', coinRoutes);
app.use('/api/dashboard', dashboardRoutes);

// rutas de administracion de la tienda
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues'); // Ruta del tablero

// Middleware de manejo de errores
app.use(errorHandler);

export const api = functions.https.onRequest(app);

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Servidor corriendo en http://localhost:${PORT}`);
// });
