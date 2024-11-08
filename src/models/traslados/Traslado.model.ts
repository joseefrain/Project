import mongoose, { Schema, Document, ObjectId } from 'mongoose';
import { ISucursal } from '../sucursales/Sucursal.model';
import { IUser } from '../usuarios/User.model';
import { IDetalleTraslado, IDetalleTrasladoCreate, IDetalleTrasladoEnvio, IDetalleTrasladoRecepcion } from './DetalleTraslado.model';
import { IMovimientoInventario } from '../inventario/MovimientoInventario.model';
import { IInventarioSucursal } from '../inventario/InventarioSucursal.model';

type IEstatusPedido = 'Solicitado' | 'En Proceso' | 'Terminado' | 'Terminado incompleto';

export interface ITraslado extends Document {
  nombre: string;
  fechaRegistro: Date;
  fechaEnvio: Date;
  fechaRecepcion: Date | null;
  sucursalOrigenId: mongoose.Types.ObjectId | ISucursal;
  sucursalDestinoId: mongoose.Types.ObjectId | ISucursal;
  usuarioIdEnvia: mongoose.Types.ObjectId | IUser;
  usuarioIdRecibe: mongoose.Types.ObjectId | IUser | null;
  estado: string;
  comentarioEnvio: string;
  consecutivo?: number;
  comentarioRecepcion: string | null;
  estatusTraslado?: IEstatusPedido;
  archivosAdjuntos: string[] | null;
  archivosAdjuntosRecibido: string[] | null;
  firmaEnvio: string;
  firmaRecepcion: string;
  deleted_at: Date | null;
}

export interface ITrasladoDto extends ITraslado {
  listItemDePedido: IDetalleTraslado[];
}

export interface ITrasladoEnvio {
  sucursalOrigenId: string;
  sucursalDestinoId: string;
  listDetalleTraslado: IDetalleTrasladoEnvio[];
  archivosAdjuntos?: string[] | null;
  firmaEnvio: string;
  comentarioEnvio: string;
  usuarioIdEnvia: string;
}

export interface ITrasladoRecepcion {
  trasladoId: string;
  estatusTraslado?: IEstatusPedido;
  listDetalleTraslado: IDetalleTrasladoRecepcion[];
  archivosAdjuntosRecibido: string[] | null;

  // Datos para enviar el pedido
  firmaRecepcion: string;
  comentarioRecepcion: string;
  usuarioIdRecibe: string;
}

export interface ISendTrasladoProducto {
  firmaEnvio: string;
  comentarioEnvio: string;
  trasladoId: mongoose.Types.ObjectId;
  traslado: ITraslado;
}

export interface IResponseToAddCantidad{
  listHistorialInventario: IMovimientoInventario[];
  listDetalleTrasladoAgregados: IDetalleTrasladoCreate[];
  listDetalleTrasladoActualizado: IDetalleTraslado[];
  listInventarioSucursalAgregados: IInventarioSucursal[];
  listInventarioSucursalActualizado: IInventarioSucursal[];
}


const trasladoSchema: Schema = new Schema(
  {
    nombre: { type: String },
    fechaRegistro: { type: Date, required: true },
    fechaEnvio: { type: Date },
    fechaRecepcion: { type: Date, default: null },
    sucursalOrigenId: {
      type: Schema.Types.ObjectId,
      ref: 'Sucursal',
      required: true,
    },
    sucursalDestinoId: {
      type: Schema.Types.ObjectId,
      ref: 'Sucursal',
      required: true,
    },
    usuarioIdEnvia: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    usuarioIdRecibe: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    estado: { type: String, required: true },
    comentarioEnvio: { type: String, default: '' },
    consecutivo: { type: Number },
    comentarioRecepcion: { type: String, default: null },
    estatusTraslado: { type: String },
    archivosAdjuntos: { type: Array<string>, default: null },
    archivosAdjuntosRecibido: { type: Array<string>, default: null },
    firmaEnvio: { type: String, default: '' },
    firmaRecepcion: { type: String, default: '' },
    deleted_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'update_at' },
  }
);

export const Traslado = mongoose.model<ITraslado>('Traslado', trasladoSchema);
