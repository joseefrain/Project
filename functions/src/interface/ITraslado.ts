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
  _detalleTralado: IDetalleTraslado[];
}

export interface ISubtractCantidadByDetalleTraslado {
  listItems: IDetalleTrasladoCreate[];
}

export interface IGenerateItemDePedidoByPedido {
  trasladoId: string;
  listDetalleTraslado: IDetalleTrasladoEnvio[] | IDetalleTrasladoRecepcion[] | IDetalleTraslado[];
  isNoSave: boolean;
}

export interface ISendPedidoHerramienta {
  model: ISendTrasladoProducto;
  usuarioEnviaId: string;
}

export interface IGeneratePedidoHerramienta {
  sucursalEnviaId: string;
  sucursalRecibeId: string;
}
