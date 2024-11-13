import { CajaRepository } from '../../repositories/caja/cashRegister.repository';
import { ICaja } from '../../models/cashRegister/CashRegister.model';
import { inject, injectable } from 'tsyringe';
import mongoose, { mongo, Types } from 'mongoose';
import { IActualizarMontoEsperadoByVenta, IAddExpenseDailySummary, IAddIncomeDailySummary, IOpenCashService, tipeCashRegisterMovement } from '../../interface/ICaja';
import { MovimientoCajaRepository } from '../../repositories/caja/movimientoCaja.repository';
import { ResumenCajaDiarioRepository } from '../../repositories/caja/DailyCashSummary.repository';

@injectable()
export class CashRegisterService {
  constructor(@inject(CajaRepository) private repository: CajaRepository,
  @inject(MovimientoCajaRepository) private movimientoRepository: MovimientoCajaRepository,
@inject(ResumenCajaDiarioRepository) private resumenRepository: ResumenCajaDiarioRepository) {}
  
  async abrirCaja(data : IOpenCashService) {
    let { sucursalId, usuarioAperturaId, montoInicial } = data;

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const cajaAbierta = await this.repository.obtenerCajaAbiertaPorSucursal(sucursalId);
    
      if (cajaAbierta) return cajaAbierta;

      let dataOpenCash = {
        sucursalId,
        usuarioAperturaId,
        montoInicial,
        session
      }
      let caja = await this.repository.abrirCaja(dataOpenCash);

      let movimiento = {
        cajaId: (caja._id as mongoose.Types.ObjectId),
        monto: new Types.Decimal128(montoInicial.toString()),
        tipoMovimiento: tipeCashRegisterMovement.APERTURA,
        usuarioId:new Types.ObjectId(usuarioAperturaId),
        fecha: new Date(),
        descripcion: 'Apertura de caja',
      }
      await this.movimientoRepository.create(movimiento, session);

      let resumenDiario:IAddIncomeDailySummary = {
        ingreso: montoInicial,
        session,
        sucursalId,
        cajaId: (caja._id as Types.ObjectId).toString()
      }  
      await this.resumenRepository.addIncomeDailySummary(resumenDiario);


      await session.commitTransaction();
      session.endSession();

      return caja;
      
    } catch (error) {
      console.log(error);

      await session.abortTransaction();
      session.endSession();

      throw new Error(error.message);
    }
  }

  async cerrarCaja(cajaId: string, montoFinalDeclarado: string): Promise<ICaja> {

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const caja = await this.repository.obtenerCajaPorId(cajaId);

      if (!caja) throw new Error('Caja no encontrada');

      if (caja.estado !== 'abierta') throw new Error('La caja ya está cerrada');

      await this.repository.cerrarCaja(cajaId, montoFinalDeclarado, session)

      await session.commitTransaction();
      session.endSession();

      return caja;

    } catch (error) {
      console.log(error);
      await session.abortTransaction();
      session.endSession();
      throw new Error(error.message);
    }

  }

  async obtenerCajaPorId(cajaId: string): Promise<ICaja | null> {
    return await this.repository.obtenerCajaPorId(cajaId);
  }

  async obtenerCajasPorSucursal(sucursalId: string): Promise<ICaja[]> {
    return await this.repository.obtenerCajasPorSucursal(sucursalId);
  }

  async actualizarMontoEsperadoByVenta(props:IActualizarMontoEsperadoByVenta): Promise<ICaja | null> {
   
    const { data, session} = props;
    let cajaId = data.cajaId!
    
    let total = new Types.Decimal128(data.total!.toString());
    let monto = new Types.Decimal128(data.monto!.toString());
    let cambio = new Types.Decimal128(data.cambioCliente!.toString());

    let dataAcualizacion = {
      cajaId,
      monto: total,
      session,
    }
    let caja = (await this.repository.actualizarMontoEsperado(dataAcualizacion) as ICaja);

    await this.resumenRepository.addSaleDailySummary(data, session);

    let movimiento = {
      tipoMovimiento: tipeCashRegisterMovement.VENTA,
      monto: monto,
      fecha: new Date(),
      descripcion: 'Venta',
      usuarioId: new Types.ObjectId(data.userId),
      cajaId: (caja._id as Types.ObjectId),
      cambioCliente: cambio
    }
    await this.movimientoRepository.create(movimiento, session);

    return caja
  }

  async actualizarMontoEsperadoByIngreso(cajaId: string, ingreso:number, usuarioId:string): Promise<ICaja | null> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      let monto = new Types.Decimal128(ingreso.toString());
      let dataAcualizacion = {
        cajaId,
        monto,
        session,
      }
      let caja = (await this.repository.actualizarMontoEsperado(dataAcualizacion) as ICaja);

      let resumen:IAddIncomeDailySummary = {
        cajaId : (caja._id as Types.ObjectId).toString(),
        ingreso: ingreso,
        sucursalId: (caja.sucursalId as Types.ObjectId).toString(),
        session
      }
      await this.resumenRepository.addIncomeDailySummary(resumen);

      let movimiento = {
        tipoMovimiento: tipeCashRegisterMovement.INGRESO,
        monto,
        fecha: new Date(),
        descripcion: 'Este es un ingreso',
        usuarioId: new Types.ObjectId(usuarioId),
        cajaId: (caja._id as Types.ObjectId)
      }
      await this.movimientoRepository.create(movimiento, session);

      await session.commitTransaction();
      session.endSession();

      return caja
    } catch (error) {
      console.log(error);
      await session.abortTransaction();
      session.endSession();
      throw new Error(error.message);
    }
  }

  async actualizarMontoEsperadoByEgreso(cajaId: string, egreso: number, usuarioId: string): Promise<ICaja> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      let monto = new Types.Decimal128(egreso.toString());
      let dataAcualizacion = {
        cajaId,
        monto,
        session,
        aumentar: false
      }
      let caja = (await this.repository.actualizarMontoEsperado(dataAcualizacion) as ICaja);

      let resumen:IAddExpenseDailySummary = {
        cajaId : (caja._id as Types.ObjectId).toString(),
        expense: egreso,
        sucursalId: (caja.sucursalId as Types.ObjectId).toString(),
        session
      }
      await this.resumenRepository.addExpenseDailySummary(resumen);

      let movimiento = {
        tipoMovimiento: tipeCashRegisterMovement.EGRESO,
        monto,
        fecha: new Date(),
        descripcion: 'Este es  un egreso',
        usuarioId: new Types.ObjectId(usuarioId),
        cajaId: (caja._id as Types.ObjectId)
      }
      await this.movimientoRepository.create(movimiento, session);

      await session.commitTransaction();
      session.endSession();

      return caja
    } catch (error) {
      console.log(error);
      await session.abortTransaction();
      session.endSession();
      throw new Error(error.message);
    }
  }
}
