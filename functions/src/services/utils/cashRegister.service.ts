import { CajaRepository } from '../../repositories/caja/cashRegister.repository';
import { ICaja } from '../../models/cashRegister/CashRegister.model';
import { inject, injectable } from 'tsyringe';
import mongoose, { mongo, Types } from 'mongoose';
import { IActualizarMontoEsperadoByVenta, IAddExpenseDailySummary, IAddIncomeDailySummary, ICloseCash, IOpenCashService, tipeCashRegisterMovement } from '../../interface/ICaja';
import { MovimientoCajaRepository } from '../../repositories/caja/movimientoCaja.repository';
import { ResumenCajaDiarioRepository } from '../../repositories/caja/DailyCashSummary.repository';
import { ArqueoCajaRepository } from '../../repositories/caja/countingCash.repository';
import { IResumenCajaDiario } from '../../models/cashRegister/DailyCashSummary.model';

@injectable()
export class CashRegisterService {
  constructor(@inject(CajaRepository) private repository: CajaRepository,
              @inject(MovimientoCajaRepository) private movimientoRepository: MovimientoCajaRepository,
              @inject(ResumenCajaDiarioRepository) private resumenRepository: ResumenCajaDiarioRepository,
              @inject(ArqueoCajaRepository) private arqueoRepository: ArqueoCajaRepository) {}
  
  async abrirCaja(data : IOpenCashService) {
    let { usuarioAperturaId, montoInicial, cajaId } = data;

    try {
      
      let dataOpenCash = {
        usuarioAperturaId,
        montoInicial,
        cajaId
      }

      let caja = await this.repository.abrirCaja(dataOpenCash);

      if (caja.hasMovementCashier) {
        return caja;
      }

      let movimiento = {
        cajaId: (caja._id as mongoose.Types.ObjectId),
        monto: new Types.Decimal128(montoInicial.toString()),
        tipoMovimiento: tipeCashRegisterMovement.APERTURA,
        usuarioId:new Types.ObjectId(usuarioAperturaId),
        fecha: new Date(),
        descripcion: 'Apertura de caja',
      }

      await this.movimientoRepository.create(movimiento);

      let resumenDiario:IAddIncomeDailySummary = {
        ingreso: montoInicial,
        sucursalId: (caja.sucursalId as Types.ObjectId).toString(),
        cajaId: (caja._id as Types.ObjectId).toString()
      }  
      await this.resumenRepository.addIncomeDailySummary(resumenDiario);

      return caja;
      
    } catch (error) {
      console.log(error);

      throw new Error(error.message);
    }
  }

  async cerrarCaja({ cajaId, usuarioArqueoId, montoFinalDeclarado, closeWithoutCounting }:ICloseCash): Promise<ICaja | IResumenCajaDiario> {

    try {

      const caja = await this.repository.obtenerCajaPorId(cajaId);

      if (!caja) throw new Error('Caja no encontrada');

      if (caja.estado !== 'ABIERTA') throw new Error('La caja ya está cerrada');

      if (closeWithoutCounting) {
        caja.estado = 'CERRADA';
        await caja.save();
        return caja;
      }

      await this.repository.cerrarCaja(caja, montoFinalDeclarado);

      const length = caja.historico.length;
      let historico = caja.historico[length - 1];

      let arqueoCaja = {
        cajaId: (caja._id as Types.ObjectId),
        usuarioArqueoId: new Types.ObjectId(usuarioArqueoId),
        montoDeclarado: historico.montoFinalDeclarado,
        montoSistema: historico.montoEsperado,
        diferencia: historico.diferencia,
        fechaArqueo: historico.fechaCierre,
        comentarios: 'Caja cerrada por el usuario'
      }
      await this.arqueoRepository.create(arqueoCaja);
      
      let resumen = await this.resumenRepository.findTodayResumenByCashier(caja._id as Types.ObjectId);

      return resumen as IResumenCajaDiario;

    } catch (error) {
      console.log(error);
      
      
      throw new Error(error.message);
    }

  }

  async obtenerCajaPorId(cajaId: string): Promise<ICaja | null> {
    return await this.repository.obtenerCajaPorId(cajaId);
  }

  async obtenerCajasPorSucursal(sucursalId: string): Promise<ICaja[]> {
    return await this.repository.obtenerCajasPorSucursal(sucursalId);
  }

  async obtenerCajasAbiertaPorSucursal(sucursalId: string): Promise<ICaja[] | null> {
    return await this.repository.obtenerCajasAbiertaPorSucursal(sucursalId);
  }

  async obtenerCajasCerradaPorSucursal(sucursalId: string): Promise<ICaja[] | null> {
    return await this.repository.obtenerCajasCerradaPorSucursal(sucursalId);
  }

  async actualizarMontoEsperadoByTrasaccion(props:IActualizarMontoEsperadoByVenta): Promise<ICaja | null> {
   
    const { data} = props;
    let cajaId = data.cajaId!
    
    let total = new Types.Decimal128(data.total!.toString());
    let monto = new Types.Decimal128(data.monto!.toString());
    let cambio = new Types.Decimal128(data.cambioCliente!.toString());

    let dataAcualizacion = {
      cajaId,
      monto: total, 
      aumentar: data.tipoTransaccion === 'VENTA' ? true : false
    }

    let caja = (await this.repository.actualizarMontoEsperado(dataAcualizacion) as ICaja);

    let movimiento = {
      tipoMovimiento: data.tipoTransaccion,
      monto: monto,
      fecha: new Date(),
      descripcion: data.tipoTransaccion,   
      usuarioId: new Types.ObjectId(data.userId),
      cajaId: (caja._id as Types.ObjectId),
      cambioCliente: cambio
    }
    await this.movimientoRepository.create(movimiento);

    return caja
  }

  async actualizarMontoEsperadoByIngreso(cajaId: string, ingreso:number, usuarioId:string): Promise<ICaja | null> {
    

    try {
      

      let monto = new Types.Decimal128(ingreso.toString());
      let dataAcualizacion = {
        cajaId,
        monto,
        
      }
      let caja = (await this.repository.actualizarMontoEsperado(dataAcualizacion) as ICaja);

      let resumen:IAddIncomeDailySummary = {
        cajaId : (caja._id as Types.ObjectId).toString(),
        ingreso: ingreso,
        sucursalId: (caja.sucursalId as Types.ObjectId).toString(),
        
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
      await this.movimientoRepository.create(movimiento);

      
      

      return caja
    } catch (error) {
      console.log(error);
      
      
      throw new Error(error.message);
    }
  }

  async actualizarMontoEsperadoByEgreso(cajaId: string, egreso: number, usuarioId: string): Promise<ICaja> {
    

    try {
      

      let monto = new Types.Decimal128(egreso.toString());
      let dataAcualizacion = {
        cajaId,
        monto,
        
        aumentar: false
      }
      let caja = (await this.repository.actualizarMontoEsperado(dataAcualizacion) as ICaja);

      let resumen:IAddExpenseDailySummary = {
        cajaId : (caja._id as Types.ObjectId).toString(),
        expense: egreso,
        sucursalId: (caja.sucursalId as Types.ObjectId).toString(),
        
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
      await this.movimientoRepository.create(movimiento);

      
      

      return caja
    } catch (error) {
      console.log(error);
      
      
      throw new Error(error.message);
    }
  }
}
