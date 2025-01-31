import { injectable } from 'tsyringe';
import { ITransaccion, Transaccion, TypeTransaction } from '../../models/transaction/Transaction.model';
import mongoose, { DeleteResult, mongo } from 'mongoose';
import { DetalleTransaccion, IDetalleTransaccion } from '../../models/transaction/DetailTransaction.model';
import { ITransaccionDescuentosAplicados, TransaccionDescuentosAplicados } from '../../models/transaction/TransactionDescuentosAplicados.model';
import { getDateInManaguaTimezone } from '../../utils/date';

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

  async deletedDescuentoAplicadoByTransaccionDetailsId(detalleTransaccionId:string):Promise<DeleteResult> {

   let respuesta = await this.modelVentaDescuentosAplicados.deleteOne({detalleVentaId:detalleTransaccionId}).exec()
   return respuesta
  }

  async findAllDetalleVentaByVentaId(ventaId: string): Promise<IDetalleTransaccion[]> {
    const detalleVenta = await this.modelDetalleTransaction.find({ ventaId: ventaId, deleted_at:null }).populate("productoId");

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
  async findByTypeAndBranch(sucursalId: string, type: TypeTransaction): Promise<ITransaccion[]> {
    const venta = await this.model.find({ sucursalId: sucursalId, tipoTransaccion: type, estadoTrasaccion:"PAGADA" }).populate([{
      path: 'usuarioId',
    }, {
      path: 'transactionDetails',
      populate: {
        path: 'productoId',
      },
    }]);

    return venta;
  }

  async findByTypeAndBranchDevolucion(sucursalId: string): Promise<ITransaccion[]> {
    const venta = await this.model.find({ sucursalId: sucursalId, tipoTransaccion: "DEVOLUCION" }).populate([{
      path: 'usuarioId',
    }, {
      path: 'transactionDetails',
      populate: {
        path: 'productoId',
      },
    }, {
      path: 'transaccionOrigenId',
    }]);

    return venta;
  }

  async findAllVentaBySucursalIdAndUserId(sucursalId: string, userId: string): Promise<ITransaccion[]> {
    const venta = await this.model.find({ sucursalId: sucursalId, usuarioId: userId, tipoTransaccion: "VENTA" });

    return venta;
  }
  async findTransaccionById(id: string): Promise<ITransaccion | null> {
    const transaccion = await this.model.findById(id).populate("usuarioId");

    if (!transaccion) {
      return null;
    }

    return transaccion;
  }
  async update(id: string, data: Partial<ITransaccion>, ): Promise<ITransaccion | null> {
    return await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async findById(id: string): Promise<ITransaccion | null> {
    return await this.model.findById(id).exec();
  }

  async findPaidTransactionsDayBySucursalId(sucursalId: string): Promise<ITransaccion[]> {
    const startOfDay = getDateInManaguaTimezone();
    startOfDay.setHours(0, 0, 0, 0);
  
    const endOfDay = getDateInManaguaTimezone();
    endOfDay.setHours(23, 59, 59, 999);
  
    const transacciones = await Transaccion.find({
      sucursalId,
      fechaRegistro: { $gte: startOfDay, $lte: endOfDay },
      tipoTransaccion: 'VENTA',
      estadoTrasaccion: 'PAGADA',
    }).populate('transactionDetails');

    return transacciones;
  }
}
