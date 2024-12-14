import { injectable } from 'tsyringe';
import { ITransaccion, Transaccion } from '../../models/Ventas/Venta.model';
import mongoose, { mongo } from 'mongoose';
import { DetalleTransaccion, IDetalleTransaccion } from '../../models/Ventas/DetalleVenta.model';
import { ITransaccionDescuentosAplicados, TransaccionDescuentosAplicados } from '../../models/Ventas/VentaDescuentosAplicados.model';

@injectable()
export class TransactionRepository {
  private model: typeof Transaccion;
  private modelDetalleTransaction: typeof DetalleTransaccion;
  private modelVentaDescuentosAplicados: typeof TransaccionDescuentosAplicados;

  constructor() {
    this.model = Transaccion;
    this.modelDetalleTransaction = DetalleTransaccion;
    this.modelVentaDescuentosAplicados = TransaccionDescuentosAplicados;
  }

  async create(data: Partial<ITransaccion>, ): Promise<ITransaccion> {
    const descuento = new this.model({...data, activo: true});
    return await descuento.save();
  }

  async createDetalleVenta(data: Partial<IDetalleTransaccion>, ): Promise<IDetalleTransaccion> {
    const descuento = new this.modelDetalleTransaction(data);
    return await descuento.save();
  }
  async createVentaDescuentosAplicados(data: Partial<ITransaccionDescuentosAplicados>, ): Promise<ITransaccionDescuentosAplicados> {
    const descuento = new this.modelVentaDescuentosAplicados(data);
    return await descuento.save();
  }
  async findAllDetalleVentaByVentaId(ventaId: string): Promise<IDetalleTransaccion[]> {
    const detalleVenta = await this.modelDetalleTransaction.find({ ventaId: ventaId }).populate("productoId");

    return detalleVenta;
  }
  async findVentaDescuentosAplicadosByDetalleVentaId(detalleVentaId: string): Promise<ITransaccionDescuentosAplicados> {
    const ventaDescuentosAplicados = (
      (await this.modelVentaDescuentosAplicados.findOne({
        detalleVentaId: detalleVentaId,
      })) as ITransaccionDescuentosAplicados
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
  async findAllVentaBySucursalId(sucursalId: string): Promise<ITransaccion[]> {
    const venta = await this.model.find({ sucursalId: sucursalId }).populate("usuarioId");

    return venta;
  }
  async findAllVentaBySucursalIdAndUserId(sucursalId: string, userId: string): Promise<ITransaccion[]> {
    const venta = await this.model.find({ sucursalId: sucursalId, usuarioId: userId });

    return venta;
  }
  async findVentaById(id: string): Promise<ITransaccion | null> {
    const venta = await this.model.findById(id).populate("usuarioId");

    if (!venta) {
      return null;
    }

    return venta;
  }
  async update(id: string, data: Partial<ITransaccion>, ): Promise<ITransaccion | null> {
    return await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }
}
