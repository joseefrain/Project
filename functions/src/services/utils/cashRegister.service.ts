import { CajaRepository } from '../../repositories/caja/cashRegister.repository';
import { ICaja } from '../../models/cashRegister/CashRegister.model';
import { inject, injectable } from 'tsyringe';
import mongoose, { Types } from 'mongoose';
import {
  IActualizarMontoEsperadoByVenta,
  IAddExpenseDailySummary,
  IAddIncomeDailySummary,
  ICloseCash,
  ICreataCashRegister,
  IOpenCashService,
  tipeCashRegisterMovement,
} from '../../interface/ICaja';
import { MovimientoCajaRepository } from '../../repositories/caja/movimientoCaja.repository';
import { ResumenCajaDiarioRepository } from '../../repositories/caja/DailyCashSummary.repository';
import { ArqueoCajaRepository } from '../../repositories/caja/countingCash.repository';
import { IResumenCajaDiario } from '../../models/cashRegister/DailyCashSummary.model';
import { getDateInManaguaTimezone } from '../../utils/date';
import { UserService } from '../user/User.service';
import { formatDecimal128, formatObejectId } from '../../gen/handleDecimal128';

@injectable()
export class CashRegisterService {
  constructor(
    @inject(CajaRepository) private repository: CajaRepository,
    @inject(MovimientoCajaRepository) private movimientoRepository: MovimientoCajaRepository,
    @inject(ResumenCajaDiarioRepository) private resumenRepository: ResumenCajaDiarioRepository,
    @inject(ArqueoCajaRepository) private arqueoRepository: ArqueoCajaRepository,
    @inject(UserService) private userService: UserService
  ) {}

  async obtenerCajasAbiertasPorUsuarioYSucursal(usuarioId: string, sucursalId: string): Promise<ICaja | null> {
    return await this.repository.obtenerCajasAbiertasPorUsuarioYSucursal(usuarioId, sucursalId);
  }

  async abrirCaja(data: IOpenCashService) {
    let { usuarioAperturaId, montoInicial, cajaId, userId } = data;

    try {
      const cajaExist = await this.repository.obtenerCajaPorId(cajaId);
      if (!cajaExist) throw new Error('Caja no encontrada');

      let dataOpenCash = {
        usuarioAperturaId,
        montoInicial,
        cajaId,
        userId,
      };
      const sucursalId = cajaExist.sucursalId as Types.ObjectId;
      const sucursalIdStr = sucursalId.toString();

      let cajaPorUsuario = await this.repository.obtenerCajasAbiertasPorUsuarioYSucursal(
        usuarioAperturaId,
        sucursalIdStr
      );

      if (cajaPorUsuario) {
        return `El usuario ya tiene una caja abierta en esta sucursal caja: ${cajaExist.consecutivo}`;
      }

      let caja = await this.repository.abrirCaja(dataOpenCash);

      if (caja.hasMovementCashier) {
        return caja;
      }

      let movimiento = {
        cajaId: caja._id as mongoose.Types.ObjectId,
        monto: new Types.Decimal128(montoInicial.toString()),
        tipoMovimiento: tipeCashRegisterMovement.APERTURA,
        usuarioId: new Types.ObjectId(usuarioAperturaId),
        fecha: getDateInManaguaTimezone(),
        descripcion: 'Apertura de caja',
      };

      await this.movimientoRepository.create(movimiento);

      await this.resumenRepository.create(caja._id as Types.ObjectId, sucursalId, formatDecimal128(montoInicial));

      return caja;
    } catch (error) {
      console.log(error);

      throw new Error(error.message);
    }
  }

  async createCaja({ montoInicial, usuarioAperturaId, sucursalId }: ICreataCashRegister): Promise<ICaja> {
    const cashiers = await this.repository.obtenerCajasPorSucursal(sucursalId);
    const lastCashier = cashiers[cashiers.length - 1];
    let consecutivo = 1;
    if (lastCashier) consecutivo = lastCashier.consecutivo + 1;
    return await this.repository.create({ montoInicial, usuarioAperturaId, sucursalId, consecutivo });
  }

  async verifyExistResumenCajaDiario(cajaId: string): Promise<boolean> {
    try {
      let cajaIdMongo = formatObejectId(cajaId);
      let exist = await this.resumenRepository.findByDateAndCashier(cajaIdMongo);
      return exist ? true : false;
    } catch (error) {
      console.log(error);

      throw new Error(error.message);
    }
  }

  async cierreAutomatico(cajaId: string): Promise<ICaja | IResumenCajaDiario> {
    try {
      let userRoot = await this.userService.findRootUser();
      if (!userRoot) throw new Error('No se encontro el usuario root');

      let caja = await this.repository.obtenerCajaPorId(cajaId);
      if (!caja) throw new Error('Caja no encontrada');

      let motivoCierre = 'Cierre automático por el usuario root';

      let cerrar = await this.cerrarCaja({
        cajaId,
        usuarioArqueoId: formatObejectId (userRoot._id).toString(),
        montoFinalDeclarado: caja.montoEsperado.toString(),
        closeWithoutCounting: false,
        motivoCierre,
      });

      return cerrar;
    } catch (error) {
      console.log(error);

      throw new Error(error.message);
    }
  }

  async cerrarCaja({
    cajaId,
    usuarioArqueoId,
    montoFinalDeclarado,
    closeWithoutCounting,
    motivoCierre = 'Caja cerrada por el usuario',
  }: ICloseCash): Promise<ICaja | IResumenCajaDiario> {
    try {
      const isRoot = await this.userService.verifyUserRoot(usuarioArqueoId);

      let caja: ICaja | null = null;

      if (isRoot) {
        caja = await this.repository.obtenerCajaPorId(cajaId);
      } else {
        caja = await this.repository.obtenerCajaAbiertaPorUsuarioYCajaId(usuarioArqueoId, cajaId);
      }

      if (!caja) throw new Error('Caja no encontrada o no ha sido abierta por el usuario');

      if (caja.estado !== 'ABIERTA') throw new Error('La caja ya está cerrada');

      await this.repository.createHistorico(caja, montoFinalDeclarado);

      if (closeWithoutCounting) {
        caja.estado = 'CERRADA';
        caja.fechaApertura = null;
        caja.fechaCierre = null;
        caja.usuarioAperturaId = null;
        await caja.save();
        return caja;
      }

      await this.repository.cerrarCaja(caja);

      const length = caja.historico.length;
      let historico = caja.historico[length - 1];

      let arqueoCaja = {
        cajaId: caja._id as Types.ObjectId,
        usuarioArqueoId: new Types.ObjectId(usuarioArqueoId),
        montoDeclarado: historico.montoFinalDeclarado,
        montoSistema: historico.montoEsperado,
        diferencia: historico.diferencia,
        fechaArqueo: historico.fechaCierre,
        comentarios: motivoCierre,
      };
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

  async actualizarMontoEsperadoByTrasaccion(props: IActualizarMontoEsperadoByVenta): Promise<ICaja | null> {
    const { data } = props;
    let cajaId = data.cajaId!;

    let monto = new Types.Decimal128(data.monto!.toString());
    let cambio = new Types.Decimal128(data.cambioCliente!.toString());
    let total = new Types.Decimal128(data.total!.toString());

    let montoAumentar = data.esDineroExterno ? monto : total;

    let dataAcualizacion = {
      cajaId,
      monto: montoAumentar,
      aumentar: data.tipoTransaccion === 'VENTA' ? true : false,
    };

    let caja = (await this.repository.actualizarMontoEsperado(dataAcualizacion)) as ICaja;

    let movimiento = {
      tipoMovimiento: data.tipoTransaccion,
      monto: monto,
      fecha: getDateInManaguaTimezone(),
      descripcion: data.tipoTransaccion,
      usuarioId: new Types.ObjectId(data.userId),
      cajaId: caja._id as Types.ObjectId,
      cambioCliente: cambio,
      trasaccionId: data.id,
      esDineroExterno: data?.esDineroExterno ?? false,
      montoExterno: formatDecimal128(data.montoExterno ?? 0)
    };

    await this.movimientoRepository.create(movimiento);

    return caja;
  }

  async actualizarMontoEsperadoByIngreso(cajaId: string, ingreso: number, usuarioId: string): Promise<ICaja | null> {
    try {
      let monto = new Types.Decimal128(ingreso.toString());
      let dataAcualizacion = {
        cajaId,
        monto,
      };
      let caja = (await this.repository.actualizarMontoEsperado(dataAcualizacion)) as ICaja;

      let resumen: IAddIncomeDailySummary = {
        cajaId: (caja._id as Types.ObjectId).toString(),
        ingreso: ingreso,
        sucursalId: (caja.sucursalId as Types.ObjectId).toString(),
      };
      await this.resumenRepository.addIncomeDailySummary(resumen);

      let movimiento = {
        tipoMovimiento: tipeCashRegisterMovement.INGRESO,
        monto,
        fecha: getDateInManaguaTimezone(),
        descripcion: 'Este es un ingreso',
        usuarioId: new Types.ObjectId(usuarioId),
        cajaId: caja._id as Types.ObjectId,
      };
      await this.movimientoRepository.create(movimiento);

      return caja;
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

        aumentar: false,
      };
      let caja = (await this.repository.actualizarMontoEsperado(dataAcualizacion)) as ICaja;

      let resumen: IAddExpenseDailySummary = {
        cajaId: (caja._id as Types.ObjectId).toString(),
        expense: egreso,
        sucursalId: (caja.sucursalId as Types.ObjectId).toString(),
      };
      await this.resumenRepository.addExpenseDailySummary(resumen);

      let movimiento = {
        tipoMovimiento: tipeCashRegisterMovement.EGRESO,
        monto,
        fecha: getDateInManaguaTimezone(),
        descripcion: 'Este es  un egreso',
        usuarioId: new Types.ObjectId(usuarioId),
        cajaId: caja._id as Types.ObjectId,
      };
      await this.movimientoRepository.create(movimiento);

      return caja;
    } catch (error) {
      console.log(error);

      throw new Error(error.message);
    }
  }

  async obtenerCajasAbiertasPorUsuario(usuarioId: string): Promise<ICaja | null> {
    return await this.repository.obtenerCajasAbiertasPorUsuario(usuarioId);
  }

  async findDailyCashierByCajaId(cajaId: string, limit: number = 10, skip: number = 0): Promise<IResumenCajaDiario[]> {
    return await this.resumenRepository.findAll({ cajaId }, limit, skip);
  }
}
