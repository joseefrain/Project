import mongoose, { Document, Schema, Model } from 'mongoose';
import { IVentaCreate } from '../Ventas/Venta.model';

interface IResumenCajaDiario extends Document {
  sucursalId: mongoose.Types.ObjectId;
  fecha: Date;
  totalVentas: mongoose.Types.Decimal128;
  totalIngresos: mongoose.Types.Decimal128;
  totalEgresos: mongoose.Types.Decimal128;
  montoFinalSistema: mongoose.Types.Decimal128;
  montoDeclaradoPorUsuario?: mongoose.Types.Decimal128 | null;
  diferencia?: mongoose.Types.Decimal128 | null;
  ventas: IVentaCreate[];
}

const resumenCajaDiarioSchema: Schema<IResumenCajaDiario> = new Schema({
  sucursalId: {
    type: Schema.Types.ObjectId,
    ref: 'Sucursal',
    required: true,
  },
  fecha: {
    type: Date,
    required: true,
  },
  totalVentas: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  totalIngresos: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  totalEgresos: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  montoFinalSistema: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  montoDeclaradoPorUsuario: {
    type: Schema.Types.Decimal128,
    default: null,
  },
  diferencia: {
    type: Schema.Types.Decimal128,
    default: null,
  },
  ventas: {
    type: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'Usuario',
          required: true,
        },
        sucursalId: {
          type: Schema.Types.ObjectId,
          ref: 'Sucursal',
          required: true,
        },
        subtotal: {
          type: Schema.Types.Decimal128,
          required: true,
        },
        total: {
          type: Schema.Types.Decimal128,
          required: true,
        },
        discount: {
          type: Schema.Types.Decimal128,
          default: 0,
        },
        fechaRegistro: {
          type: Date,
          required: true,
          default: Date.now,
        },
        products: {
          type: [
            {
              ventaId: {
                type: String,
                required: true,
              },
              productId: {
                type: String,
                required: true,
              },
              groupId: {
                type: String,
                required: true,
              },
              clientType: {
                type: String,
                enum: ['Regular', 'Proveedor'],
                required: true,
              },
              productName: {
                type: String,
                required: true,
              },
              quantity: {
                type: Number,
                required: true,
              },
              price: {
                type: Number,
                required: true,
              },
              inventarioSucursalId: {
                type: String,
                required: true,
              },
              discount: {
                type: {
                  id: String,
                  name: String,
                  amount: Number,
                  percentage: Number,
                  type: String,
                },
                required: false,
              },
            },
          ],
          required: true,
        },
      },
    ],
    required: true,
  },
});

// Exportamos el modelo como `ResumenCajaDiario`
const ResumenCajaDiario: Model<IResumenCajaDiario> = mongoose.model<IResumenCajaDiario>('ResumenCajaDiario', resumenCajaDiarioSchema);

export default ResumenCajaDiario;
