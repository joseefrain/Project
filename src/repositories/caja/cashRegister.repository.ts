import mongoose, { Model, mongo, Types } from 'mongoose';
import Caja, { ICaja } from '../../models/cashRegister/CashRegister.model';
import { injectable } from 'tsyringe';
import { IActualizarMontoEsperado, IOpenCash } from 'src/interface/ICaja';

@injectable()
export class CajaRepository {
  private cajaModel: Model<ICaja>;

  constructor() {
    this.cajaModel = Caja;
  }

  async abrirCaja({montoInicial, usuarioAperturaId, sucursalId, session}: IOpenCash): Promise<ICaja> {
    const nuevaCaja = new this.cajaModel({
      fechaApertura: new Date(),
      estado: 'abierta',
      usuarioAperturaId,
      sucursalId,
      montoInicial,
      montoEsperado: montoInicial,
    });

    return await nuevaCaja.save({ session });
  }

  async cerrarCaja(
    cajaId: string,
    montoFinalDeclarado: string,
    session: mongoose.mongo.ClientSession
  ): Promise<ICaja> {
    const caja = await this.cajaModel.findById(cajaId);
    if (!caja) throw new Error('Caja no encontrada');
    if (caja.estado === 'cerrada') throw new Error('La caja ya está cerrada');

    let montoFinalDeclaradoFormateado = new mongoose.mongo.Decimal128(montoFinalDeclarado)
    let diferencia = caja.montoEsperado ? (parseFloat(caja.montoEsperado.toString()) - parseFloat(montoFinalDeclaradoFormateado.toString())) : 0;

    caja.montoFinalDeclarado = montoFinalDeclaradoFormateado;
    caja.diferencia = new mongoose.mongo.Decimal128(diferencia.toString());
    caja.fechaCierre = new Date();
    caja.estado = 'cerrada';

    return await caja.save({ session });
  }

  async obtenerCajaPorId(cajaId: string): Promise<ICaja | null> {
    return await this.cajaModel.findById(cajaId);
  }

  async obtenerCajaAbiertaPorSucursal(sucursalId: string): Promise<ICaja | null> {
    return await this.cajaModel.findOne({ sucursalId, estado: 'abierta' });
  }

  // Obtener todas las cajas por sucursal
  async obtenerCajasPorSucursal(sucursalId: string): Promise<ICaja[]> {
    return await this.cajaModel.find({ sucursalId }).sort({ fechaApertura: -1 });
  }
  

  // Actualizar el monto esperado en la caja
  async actualizarMontoEsperado(data:IActualizarMontoEsperado): Promise<ICaja | null> {

    const { cajaId, monto, session, aumentar = true } = data;

    return await this.cajaModel.findByIdAndUpdate(
      cajaId,
      { $inc: { montoEsperado: aumentar ? monto : -monto } },
      { new: true, session }
    );
  }
}
