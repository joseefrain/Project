import mongoose, { Schema, Document, Model } from 'mongoose';
import { ISucursal, Sucursal } from '../sucursales/Sucursal.model';
import { Entity, IEntity } from '../entity/Entity.model';
import { ITransaccion, Transaccion } from '../Ventas/Venta.model';

type TypeCredito = 'VENTA' | 'COMPRA';
export type ModalidadCredito = 'PLAZO' | 'PAGO';
type TypeEstadoCredito = 'ABIERTO' | 'CERRADO';
type EstadoPagoCuata = 'PENDIENTE' | 'PAGADO' | 'ATRASADO';

export interface IPagoCredito {
  montoPago: mongoose.Types.Decimal128;
  saldoPendiente: mongoose.Types.Decimal128;
  fechaPago: Date;
}

export interface ICuotasCredito {
  numeroCuota: number;
  montoCuota: mongoose.Types.Decimal128;
  montoCapital: mongoose.Types.Decimal128;
  fechaVencimiento: Date;
  estadoPago: EstadoPagoCuata
  fechaCuota: Date;
}

export interface ICredito extends Document {
  sucursalId: mongoose.Types.ObjectId | ISucursal;
  entidadId: mongoose.Types.ObjectId | IEntity;
  tipoCredito: TypeCredito;
  modalidadCredito: ModalidadCredito;
  saldoCredito: mongoose.Types.Decimal128;
  saldoPendiente: mongoose.Types.Decimal128;
  estadoCredito: TypeEstadoCredito;
  fecheInicio: Date;
  transaccionId: mongoose.Types.ObjectId | ITransaccion;
  deleted_at: Date | null;
  //variables para el credio de plazo
  plazoCredito: number; // En meses
  cuotaMensual: mongoose.Types.Decimal128;
  fechaVencimiento: Date;

  //variables para el credito de pago
  pagoMinimoMensual: mongoose.Types.Decimal128;
  // pagos por tipo de credito

  pagosCredito: IPagoCredito[];
  cuotasCredito: ICuotasCredito[];
}

const pagosCreditoSchema = new Schema(
  {
    montoPago: { type: mongoose.Types.Decimal128, required: true },
    saldoPendiente: { type: mongoose.Types.Decimal128, required: true },
    fechaPago: { type: String, required: true },
  },
  { _id: false }
);

const cuotasCreditoSchema = new Schema(
  {
    numeroCuota: { type: Number, required: true },
    montoCuota: { type: mongoose.Types.Decimal128, required: true },
    montoCapital: { type: mongoose.Types.Decimal128, required: true },
    fechaVencimiento: { type: String, required: true },
    estadoPago: { type: String, required: true },
    fechaCuota: { type: String, required: true },
  },
  { _id: false }
);

const creditoSchema: Schema<ICredito> = new Schema({
  sucursalId: {
    type: Schema.Types.ObjectId,
    ref: Sucursal,
    required: true,
  },
  entidadId: {
    type: Schema.Types.ObjectId,
    ref: Entity,
    required: true,
  },
  tipoCredito: {
    type: String,
    enum: ['VENTA', 'COMPRA'],
    required: true,
  },
  modalidadCredito: {
    type: String,
    enum: ['PLAZO', 'PAGO'],
    required: true,
  },
  saldoCredito: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  saldoPendiente: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  estadoCredito: {
    type: String,
    enum: ['ABIERTO', 'CERRADO'],
    required: true,
  },
  plazoCredito: {
    type: Number,
    required: true,
  },
  cuotaMensual: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  fechaVencimiento: {
    type: Date,
    required: true,
  },
  pagoMinimoMensual: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  transaccionId: {
    type: Schema.Types.ObjectId,
    ref: Transaccion,
    required: true,
  },
  pagosCredito: [{ type: pagosCreditoSchema, required: true }],
  cuotasCredito: [{ type: cuotasCreditoSchema, required: true }],
  deleted_at: { type: Date, required: false },
});

// Exportamos el modelo como `Credito`
export const Credito: Model<ICredito> = mongoose.model<ICredito>(
  'Credito',
  creditoSchema
);

