import 'reflect-metadata';
import * as dotenv from 'dotenv';
import connectDB from './config/database';
import userRoutes from './routes/user.routes';
import branchRoutes from './routes/branch.routes';
import productRoutes from './routes/inventario/producto.routes';
import { errorHandler } from './middlewares/errorHandler';
import grupoRoutes from './routes/inventario/grupo.routes';
import productTransfer from './routes/traslado/traslado.routes';
import descuentos from './routes/venta/descuento.routes';
import ventaRoutes from './routes/venta/venta.routes';
import { inventarioQueue } from './queues/inventarioQueue';
import { ExpressAdapter } from '@bull-board/express';
import { BullAdapter } from '@bull-board/api/bullAdapter'; // Si usas Bull
import { createBullBoard } from '@bull-board/api';

const express = require('express');
const cors = require('cors');

dotenv.config();

const app = express();
const port = process.env.PORT;

connectDB();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rutas
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

// rutas de administracion de la tienda
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues'); // Ruta del tablero

createBullBoard({
  queues: [new BullAdapter(inventarioQueue)], // Si usas Bull. Usa `BullMQAdapter` si usas BullMQ.
  serverAdapter,
});

// Montar el tablero en la ruta '/admin/queues'
app.use('/admin/queues', serverAdapter.getRouter());

app.delete('/admin/queues/clear', async (req, res) => {
  try {
    await inventarioQueue.empty();

    await inventarioQueue.clean(0, 'completed'); // Limpia todos los trabajos completados
    await inventarioQueue.clean(0, 'failed');    // Limpia todos los trabajos fallidos

    await inventarioQueue.obliterate({ force: true });

    res.status(200).json({ message: 'Cola limpiada correctamente.' });
  } catch (error) {
    console.error("Error al limpiar la cola:", error);
    res.status(500).json({ message: 'Hubo un error al limpiar la cola.' });
  }
});

// Middleware de manejo de errores
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
