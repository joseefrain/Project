import { injectable } from 'tsyringe';
import { Descuento, IDescuento, IDescuentoCreate, IListDescuentoResponse} from '../../models/Ventas/Descuento.model';
import { DescuentoGrupo, IDescuentoGrupo } from '../../models/Ventas/DescuentoGrupo.model';
import { DescuentosProductos, IDescuentosProductos } from '../../models/Ventas/DescuentosProductos.model';
import mongoose, { mongo } from 'mongoose';

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

  async create(data: Partial<IDescuentoCreate>, session: mongoose.mongo.ClientSession): Promise<IDescuento> {
    const descuento = new this.model({...data, activo: true});
    return await descuento.save({ session });
  }

  async createDescuentoProducto(data: Partial<IDescuentosProductos>, session: mongoose.mongo.ClientSession): Promise<void> {
    const descuento = new this.modelDescuentoProducto(data);
    await descuento.save({ session });
  }
  async createDescuentoGrupo(data: Partial<IDescuentoGrupo>, session: mongoose.mongo.ClientSession): Promise<void> {
    const descuento = new this.modelDescuentoGrupo(data);
    await descuento.save({ session });
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

    let hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const queryProductos = await this.modelDescuentoProducto.find({ deleted_at: null }).populate(["descuentoId"]);
    const queryGrupos = await this.modelDescuentoGrupo.find({ deleted_at: null }).populate("descuentoId");

    queryProductos.forEach((descuentoProducto) => {
      let descuento = (descuentoProducto.descuentoId as IDescuento);
      let fechaInicio = descuento.fechaInicio;
      let fechaFin = descuento.fechaFin;

      if (!descuento.activo) {
        return;
      }

      if (fechaInicio && fechaFin) {
        if (fechaInicio > hoy && fechaFin > hoy || fechaInicio < hoy && fechaFin < hoy) {
          return
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

      if (!descuento.activo) {
        return;
      }

      if (fechaInicio && fechaFin) {
        if (fechaInicio > hoy && fechaFin > hoy || fechaInicio < hoy && fechaFin < hoy) {
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

  async delete(id: string): Promise<IDescuento | null> {
    return await this.model
      .findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true })
      .exec();
  }

  async restore(id: string): Promise<IDescuento | null> {
    return await this.model
      .findByIdAndUpdate(id, { deleted_at: null }, { new: true })
      .exec();
  }
}
