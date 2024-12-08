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
import cashRegisterRoutes from './routes/venta/cashRegister.routes';
import descuentos from './routes/venta/descuento.routes';
import ventaRoutes from './routes/venta/venta.routes';
import creditoRoutes from './routes/credito/credito.routes';

const express = require('express');
const cors = require('cors');

dotenv.config();

const app = express();
const port = process.env.PORT;

connectDB();

app.use(cors());
app.use(ensureDatabaseConnection())
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
app.use('/api/venta/descuentos', descuentos);
app.use('/api/venta', ventaRoutes);
app.use('/api/cashRegister', cashRegisterRoutes);
app.use('/api/credito', creditoRoutes);

// rutas de administracion de la tienda
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues'); // Ruta del tablero

// Middleware de manejo de errores
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
