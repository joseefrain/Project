import mongoose from 'mongoose';
import {
  IDetalleTraslado,
  IDetalleTrasladoCreate,
  IDetalleTrasladoEnvio,
  IDetalleTrasladoRecepcion,
} from '../models/traslados/DetalleTraslado.model';
import { ISendTrasladoProducto } from '../models/traslados/Traslado.model';

export interface IAddCantidadTraslado {
  model: IDetalleTrasladoRecepcion;
  bodegaId: string;
  listFiles: string[];
  session: mongoose.mongo.ClientSession;
  _detalleTralado: IDetalleTraslado[];
}

export interface ISubtractCantidadByDetalleTraslado {
  listItems: IDetalleTrasladoCreate[];
  session: mongoose.mongo.ClientSession;
}

export interface IGenerateItemDePedidoByPedido {
  trasladoId: string;
  listDetalleTraslado: IDetalleTrasladoEnvio[] | IDetalleTrasladoRecepcion[] | IDetalleTraslado[];
  isNoSave: boolean;
  session: mongoose.mongo.ClientSession;
}

export interface ISendPedidoHerramienta {
  model: ISendTrasladoProducto;
  session: mongoose.mongo.ClientSession;
  usuarioEnviaId: string;
}

export interface IGeneratePedidoHerramienta {
  session: mongoose.mongo.ClientSession;
  sucursalEnviaId: string;
  sucursalRecibeId: string;
}
