import mongoose, { Model, mongo, Types } from 'mongoose';
import Caja, { ICaja, ICajaHistorico } from '../../models/cashRegister/CashRegister.model';
import { injectable } from 'tsyringe';
import { IActualizarMontoEsperado, ICreataCashRegister, IOpenCash } from '../../interface/ICaja';
import { cero128, restarDecimal128, sumarDecimal128 } from '../../gen/handleDecimal128';
import { getDateInManaguaTimezone } from '../../utils/date';

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


    let montoInicial128 = new mongoose.mongo.Decimal128(montoInicial.toString())
    let montoConMovimiento = sumarDecimal128(caja.montoEsperado, montoInicial128);

    if (!caja.hasMovementCashier) {
      caja.ganancia = cero128;
      caja.montoEsperado = montoInicial128;
    } else {
      caja.montoEsperado = montoConMovimiento
    }


    caja.montoInicial = caja.hasMovementCashier ? montoConMovimiento : montoInicial128;
    caja.estado = 'ABIERTA';
    caja.fechaApertura = getDateInManaguaTimezone();
    caja.usuarioAperturaId = new Types.ObjectId(usuarioAperturaId);

    return await caja.save();
  }

  async create ({ montoInicial, usuarioAperturaId, sucursalId, consecutivo }: ICreataCashRegister): Promise<ICaja> {
    const nuevaCaja = new this.cajaModel({
      fechaApertura: getDateInManaguaTimezone(),
      estado: 'CERRADA',
      usuarioAperturaId,
      sucursalId,
      montoInicial,
      montoEsperado: montoInicial,
      hasSubscribers: false,
      consecutivo,
      ganancia: cero128
    });

    return await nuevaCaja.save();
  }

  async createHistorico( caja: ICaja, montoFinalDeclarado: string ): Promise<ICaja> {
    if (!caja) throw new Error('Caja no encontrada');
    if (caja.estado === 'CERRADA') throw new Error('La caja ya está cerrada');

    let montoFinalDeclaradoFormateado = new mongoose.mongo.Decimal128(montoFinalDeclarado)
    let diferencia = caja.montoEsperado ? restarDecimal128(caja.montoEsperado, montoFinalDeclaradoFormateado) : cero128;

    let cajaHistorico:ICajaHistorico = {
      fechaApertura: (caja.fechaApertura as Date),
      fechaCierre: getDateInManaguaTimezone(),
      montoInicial: caja.montoInicial,
      montoFinalDeclarado: montoFinalDeclaradoFormateado,
      diferencia: diferencia,
      montoEsperado: caja.montoEsperado,
      usuarioAperturaId: (caja.usuarioAperturaId as mongoose.Types.ObjectId),
      ganancia: caja.ganancia
    } 

    caja.historico.push(cajaHistorico)

    return await caja.save();
  }


  async cerrarCaja( caja: ICaja): Promise<ICaja> {

    if (!caja) throw new Error('Caja no encontrada');
    if (caja.estado === 'CERRADA') throw new Error('La caja ya está cerrada');

    caja.estado = 'CERRADA';
    caja.usuarioAperturaId = null;
    caja.montoInicial = cero128;
    caja.montoEsperado = cero128;
    caja.montoFinalDeclarado = cero128;
    caja.diferencia = cero128;
    caja.fechaApertura = null;
    caja.fechaCierre = null;
    caja.hasMovementCashier = false;
    caja.ganancia = cero128;

    return await caja.save();
  }

  async obtenerCajaPorId(cajaId: string): Promise<ICaja | null> {
    return await this.cajaModel.findById(cajaId);
  }

  async obtenerCajasAbiertaPorSucursal(sucursalId: string): Promise<ICaja[] | null> {
    return await this.cajaModel.find({ sucursalId, estado: 'ABIERTA' }).populate('usuarioAperturaId');
  }

  async obtenerCajasCerradaPorSucursal(sucursalId: string): Promise<ICaja[] | null> {
    return await this.cajaModel.find({ sucursalId, estado: 'CERRADA' });
  }

  // Obtener todas las cajas por sucursal
  async obtenerCajasPorSucursal(sucursalId: string): Promise<ICaja[]> {
    return await this.cajaModel.find({ sucursalId }).populate('usuarioAperturaId');
  }

  async obtenerCajasAbiertasPorUsuario(userId: string): Promise<ICaja | null> {
    return await this.cajaModel.findOne({ usuarioAperturaId: userId, estado: 'ABIERTA' });
  }

  async obtenerCajasAbiertasPorUsuarioYSucursal(userId: string, sucursalId: string): Promise<ICaja | null> {
    return await this.cajaModel.findOne({ usuarioAperturaId: userId, sucursalId, estado: 'ABIERTA' });
  }

  async obtenerCajaAbiertaPorUsuarioYCajaId(userId: string, cajaId: string): Promise<ICaja | null> {
    return await this.cajaModel.findOne({ usuarioAperturaId: userId, _id: cajaId, estado: 'ABIERTA' });
  }
  

  // Actualizar el monto esperado en la caja
  async actualizarMontoEsperado(data:IActualizarMontoEsperado): Promise<ICaja | null> {

    const { cajaId, monto, aumentar = true } = data;

    const adjustedMonto = aumentar ? +Number(monto) : -Number(monto);

  let caja = await this.cajaModel.findByIdAndUpdate(
      cajaId,
      { $inc: { montoEsperado: adjustedMonto, ganancia: adjustedMonto }, hasMovementCashier: true },
      { new: true }
    );

    return caja;
  }
}
