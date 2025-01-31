import { injectable } from 'tsyringe';
import { Descuento, IDescuento, IDescuentoCreate, IListDescuentoResponse} from '../../models/transaction/Descuento.model';
import { DescuentoGrupo, IDescuentoGrupo } from '../../models/transaction/DescuentoGrupo.model';
import { DescuentosProductos, IDescuentosProductos } from '../../models/transaction/DescuentosProductos.model';
import mongoose, { DeleteResult, mongo, Types } from 'mongoose';
import { getDateInManaguaTimezone } from '../../utils/date';

@injectable()
export class DescuentoRepository {
  private model: typeof Descuento;
  private modelDescuentoProducto: typeof DescuentosProductos;
  private modelDescuentoGrupo: typeof DescuentoGrupo;

  constructor() {
    this.model = Descuento;
    this.modelDescuentoProducto = DescuentosProductos;
    this.modelDescuentoGrupo = DescuentoGrupo;
  }

  async create(data: Partial<IDescuentoCreate>, ): Promise<IDescuento> {
    const descuento = new this.model({...data, activo: true});
    return await descuento.save();
  }

  async createDescuentoProducto(data: Partial<IDescuentosProductos>, ): Promise<void> {
    const descuento = new this.modelDescuentoProducto(data);
    await descuento.save();
  }
  async createDescuentoGrupo(data: Partial<IDescuentoGrupo>, ): Promise<void> {
    const descuento = new this.modelDescuentoGrupo(data);
    await descuento.save();
  }

  async findById(id: string): Promise<IDescuento | null> {
    const descuento = await this.model.findById(id);

    if (!descuento) {
      return null;
    }

    return descuento;
  }

  async findAll(): Promise<IDescuento[]> {
    const descuentos = await this.model.find({ deleted_at: null });

    return descuentos;
  }

  async findBySucursalId(sucursalId: string): Promise<IListDescuentoResponse> {
    const descuentosPorProductosGenerales: IDescuentosProductos[] = [];
    const descuentosPorProductosEnSucursal: IDescuentosProductos[] = [];
    const descuentosPorGruposGenerales: IDescuentoGrupo[] = [];
    const descuentosPorGruposEnSucursal: IDescuentoGrupo[] = [];
    
    // Usar la función
    const hoy = getDateInManaguaTimezone();
    hoy.setHours(0, 0, 0, 0);

    const queryProductos = await this.modelDescuentoProducto.find({ deleted_at: null }).populate(["descuentoId"]);
    const queryGrupos = await this.modelDescuentoGrupo.find({ deleted_at: null }).populate("descuentoId");

    queryProductos.forEach((descuentoProducto) => {
      let descuento = (descuentoProducto.descuentoId as IDescuento);
      let fechaInicio = descuento.fechaInicio;
      let fechaFin = descuento.fechaFin;
      fechaInicio.setHours(0, 0, 0, 0);
      fechaFin.setHours(23, 59, 59, 999);


      if (!descuento.activo) {
        return;
      }

      if (fechaInicio && fechaFin) {
        if (!(fechaInicio <= hoy && hoy <= fechaFin)) {
          return;
        }
        
      }
      
      if (descuentoProducto.sucursalId) {
        if ((descuentoProducto.sucursalId as mongo.ObjectId).toString() === sucursalId) {
          descuentosPorProductosEnSucursal.push(descuentoProducto);
        }
      } else {
        descuentosPorProductosGenerales.push(descuentoProducto);
      }
    });

    queryGrupos.forEach((descuentoGrupo) => {
      let descuento = (descuentoGrupo.descuentoId as IDescuento);
      let fechaInicio = descuento.fechaInicio;
      let fechaFin = descuento.fechaFin;
      fechaInicio.setHours(0, 0, 0, 0);
      fechaFin.setHours(23, 59, 59, 999);

      if (!descuento.activo) {
        return;
      }

      if (fechaInicio && fechaFin) {
        if (!(fechaInicio <= hoy && hoy <= fechaFin)) {
          return;
        }
      }
      
      if (descuentoGrupo.sucursalId) {
        if ((descuentoGrupo.sucursalId as mongo.ObjectId).toString() === sucursalId) {
          descuentosPorGruposEnSucursal.push(descuentoGrupo);
        }
      } else {
        descuentosPorGruposGenerales.push(descuentoGrupo);
      }
    });

    const listDescuentos = {
      descuentosPorProductosGenerales,
      descuentosPorProductosEnSucursal,
      descuentosPorGruposGenerales,
      descuentosPorGruposEnSucursal,
    };

    return listDescuentos;
  }

  async findByName(
    name: string,
  ): Promise<IDescuento | null> {
    const descuento = await this.model.findOne({ nombre: name });

    return descuento;
  }

  async update(
    id: string,
    data: Partial<IDescuento>
  ): Promise<IDescuento | null> {
    return await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async deleteProductGeneral(id: Types.ObjectId, productoId:Types.ObjectId): Promise<DeleteResult> {
    let response = await this.modelDescuentoProducto.deleteOne({descuentoId:id, productoId});
    return response
  }

  async deleteProductBySucursal(id: Types.ObjectId, productoId: Types.ObjectId, sucursalId:Types.ObjectId): Promise<DeleteResult> {
    let response = await this.modelDescuentoProducto.deleteOne({descuentoId:id, productoId, sucursalId});
    return response
  }

  async deleteGroupGeneral(id: Types.ObjectId, grupoId: Types.ObjectId): Promise<DeleteResult> {
    let response = await this.modelDescuentoGrupo.deleteOne({descuentoId:id, grupoId});
    return response
  }

  async deleteGroupBySucursal(id: Types.ObjectId, grupoId: Types.ObjectId, sucursalId:Types.ObjectId): Promise<DeleteResult> {
    let response = await this.modelDescuentoGrupo.deleteOne({ descuentoId:id, grupoId, sucursalId });
    return response
    
  }

  async restore(id: string): Promise<IDescuento | null> {
    return await this.model
      .findByIdAndUpdate(id, { deleted_at: null }, { new: true })
      .exec();
  }
  async getDescuentoGrupoByDescuentoId(id: string): Promise<IDescuentoGrupo | null> {
    return await this.modelDescuentoGrupo.findOne({ descuentoId: id });
  }
  async getDescuentoProductoByDescuentoId(id: string): Promise<IDescuentosProductos | null> {
    return await this.modelDescuentoProducto.findOne({ descuentoId: id });
  }
}
