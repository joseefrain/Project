import { injectable } from 'tsyringe';
import { ITrasaccion, Trasaccion } from '../../models/Ventas/Venta.model';
import mongoose, { mongo } from 'mongoose';
import { DetalleVenta, IDetalleVenta } from '../../models/Ventas/DetalleVenta.model';
import { IVentaDescuentosAplicados, VentaDescuentosAplicados } from '../../models/Ventas/VentaDescuentosAplicados.model';

@injectable()
export class VentaRepository {
  private model: typeof Trasaccion;
  private modelDetalleVenta: typeof DetalleVenta;
  private modelVentaDescuentosAplicados: typeof VentaDescuentosAplicados;

  constructor() {
    this.model = Trasaccion;
    this.modelDetalleVenta = DetalleVenta;
    this.modelVentaDescuentosAplicados = VentaDescuentosAplicados;
  }

  async create(data: Partial<ITrasaccion>, session: mongoose.mongo.ClientSession): Promise<ITrasaccion> {
    const descuento = new this.model({...data, activo: true});
    return await descuento.save({ session });
  }

  async createDetalleVenta(data: Partial<IDetalleVenta>, session: mongoose.mongo.ClientSession): Promise<IDetalleVenta> {
    const descuento = new this.modelDetalleVenta(data);
    return await descuento.save({ session });
  }
  async createVentaDescuentosAplicados(data: Partial<IVentaDescuentosAplicados>, session: mongoose.mongo.ClientSession): Promise<IVentaDescuentosAplicados> {
    const descuento = new this.modelVentaDescuentosAplicados(data);
    return await descuento.save({ session });
  }
  async findAllDetalleVentaByVentaId(ventaId: string): Promise<IDetalleVenta[]> {
    const detalleVenta = await this.modelDetalleVenta.find({ ventaId: ventaId }).populate("productoId");

    return detalleVenta;
  }
  async findVentaDescuentosAplicadosByDetalleVentaId(detalleVentaId: string): Promise<IVentaDescuentosAplicados> {
    const ventaDescuentosAplicados = (
      (await this.modelVentaDescuentosAplicados.findOne({
        detalleVentaId: detalleVentaId,
      })) as IVentaDescuentosAplicados
    ).populate([
      {
        path: 'descuentosProductosId',
        populate: {
          path: 'descuentoId',
        },
      },
      {
        path: 'descuentoGrupoId',
        populate: {
          path: 'descuentoId',
        },
      },
    ]);

    return ventaDescuentosAplicados;
  }
  async findAllVentaBySucursalId(sucursalId: string): Promise<ITrasaccion[]> {
    const venta = await this.model.find({ sucursalId: sucursalId }).populate("usuarioId");

    return venta;
  }
  async findAllVentaBySucursalIdAndUserId(sucursalId: string, userId: string): Promise<ITrasaccion[]> {
    const venta = await this.model.find({ sucursalId: sucursalId, usuarioId: userId });

    return venta;
  }
  async findVentaById(id: string): Promise<ITrasaccion | null> {
    const venta = await this.model.findById(id).populate("usuarioId");

    if (!venta) {
      return null;
    }

    return venta;
  }
}
