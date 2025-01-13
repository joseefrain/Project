import mongoose, { Model, mongo, Types } from 'mongoose';
import Caja, { ICaja, ICajaHistorico } from '../../models/cashRegister/CashRegister.model';
import { injectable } from 'tsyringe';
import { IActualizarMontoEsperado, ICreataCashRegister, IOpenCash } from '../../interface/ICaja';
import { cero128, restarDecimal128 } from '../../gen/handleDecimal128';
import { hasSubscribers } from 'diagnostics_channel';

@injectable()
export class CajaRepository {
  private cajaModel: Model<ICaja>;

  constructor() {
    this.cajaModel = Caja;
  }

  async abrirCaja({montoInicial, usuarioAperturaId, cajaId}: IOpenCash): Promise<ICaja> {
    const caja = await this.cajaModel.findById(cajaId);
    if (!caja) throw new Error('Caja no encontrada');
    if (caja.estado === 'ABIERTA') return caja;
    if (caja.hasMovementCashier) return caja;

    let montoInicial128 = new mongoose.mongo.Decimal128(montoInicial.toString())

    caja.montoEsperado = montoInicial128;
    caja.montoInicial = montoInicial128;
    caja.estado = 'ABIERTA';
    caja.fechaApertura = new Date();
    caja.usuarioAperturaId = new Types.ObjectId(usuarioAperturaId);

    return await caja.save();
  }

  async create ({ montoInicial, usuarioAperturaId, sucursalId, consecutivo }: ICreataCashRegister): Promise<ICaja> {
    const nuevaCaja = new this.cajaModel({
      fechaApertura: new Date(),
      estado: 'CERRADA',
      usuarioAperturaId,
      sucursalId,
      montoInicial,
      montoEsperado: montoInicial,
      hasSubscribers: false,
      consecutivo
    });

    return await nuevaCaja.save();
  }

  async cerrarCaja( caja: ICaja, montoFinalDeclarado: string ): Promise<ICaja> {

    if (!caja) throw new Error('Caja no encontrada');
    if (caja.estado === 'CERRADA') throw new Error('La caja ya está cerrada');

    let montoFinalDeclaradoFormateado = new mongoose.mongo.Decimal128(montoFinalDeclarado)
    let diferencia = caja.montoEsperado ? restarDecimal128(caja.montoEsperado, montoFinalDeclaradoFormateado) : 0;

    let cajaHistorico:ICajaHistorico = {
      fechaApertura: (caja.fechaApertura as Date),
      fechaCierre: new Date(),
      montoInicial: caja.montoInicial,
      montoFinalDeclarado: montoFinalDeclaradoFormateado,
      diferencia: new mongoose.mongo.Decimal128(diferencia.toString()),
      montoEsperado: caja.montoEsperado,
      usuarioAperturaId: (caja.usuarioAperturaId as mongoose.Types.ObjectId)
    } 
   

    // caja.montoFinalDeclarado = montoFinalDeclaradoFormateado;
    // caja.diferencia = new mongoose.mongo.Decimal128(diferencia.toString());
    // caja.fechaCierre = new Date();
    caja.estado = 'CERRADA';
    caja.historico.push(cajaHistorico);
    caja.usuarioAperturaId = null;
    caja.montoInicial = cero128;
    caja.montoEsperado = cero128;
    caja.montoFinalDeclarado = cero128;
    caja.diferencia = cero128;
    caja.fechaApertura = null;
    caja.fechaCierre = null;
    caja.hasMovementCashier = false;

    return await caja.save();
  }

  async obtenerCajaPorId(cajaId: string): Promise<ICaja | null> {
    return await this.cajaModel.findById(cajaId);
  }

  async obtenerCajasAbiertaPorSucursal(sucursalId: string): Promise<ICaja[] | null> {
    return await this.cajaModel.find({ sucursalId, estado: 'ABIERTA' });
  }

  async obtenerCajasCerradaPorSucursal(sucursalId: string): Promise<ICaja[] | null> {
    return await this.cajaModel.find({ sucursalId, estado: 'CERRADA' });
  }

  // Obtener todas las cajas por sucursal
  async obtenerCajasPorSucursal(sucursalId: string): Promise<ICaja[]> {
    return await this.cajaModel.find({ sucursalId });
  }
  

  // Actualizar el monto esperado en la caja
  async actualizarMontoEsperado(data:IActualizarMontoEsperado): Promise<ICaja | null> {

    const { cajaId, monto, aumentar = true } = data;

    const adjustedMonto = aumentar ? +Number(monto) : -Number(monto);

    let caja = await this.cajaModel.findByIdAndUpdate(
      cajaId,
      { $inc: { montoEsperado: adjustedMonto }, hasMovementCashier: true },
      { new: true }
    );

    return caja;
  }
}
