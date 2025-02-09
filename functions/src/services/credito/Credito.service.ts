import mongoose, { Types } from "mongoose";
import { parse } from "path";
import { ICredito, ICuotasCredito, ModalidadCredito, TypeCredito } from "../../models/credito/Credito.model";
import { IMovimientoFinanciero } from "../../models/credito/MovimientoFinanciero.model";
import { CreditoRepository } from "../../repositories/credito/Credito.repository";
import { MovimientoFinancieroRepository } from "../../repositories/credito/MovimientoFinanciero.repository";
import { inject, injectable } from "tsyringe";
import { TransactionRepository } from "../../repositories/transaction/transaction.repository";
import { ITransaccion, ITransaccionCreate, TypeTransaction } from "../../models/transaction/Transaction.model";
import { EntityRepository } from "../../repositories/entity/Entity.repository";
import { cero128, compareDecimal128, dividirDecimal128, formatObejectId, multiplicarDecimal128, restarDecimal128, restarDecimal1282, sumarDecimal128 } from "../../gen/handleDecimal128";
import { IClientState } from "../../models/entity/Entity.model";
import { CashRegisterService } from "../utils/cashRegister.service";
import { IActualizarMontoEsperadoByVenta, ITransactionCreateCaja, TypeEstatusTransaction } from "../../interface/ICaja";
import { EntityService } from "../entity/Entity.service";
import { getDateInManaguaTimezone } from "../../utils/date";
import { HelperMapperTransaction } from "../transaction/helpers/helperMapper";
import { IDetalleTransaccion } from "../../models/transaction/DetailTransaction.model";

export interface IHandlePagoCreditoProps {
  creditoIdStr: string;
  montoPago: string;
  modalidadCredito: ModalidadCredito;
  userId: string;
  cajaId: string;
}

export interface ICreditoResponse {
  credito: ICredito;
  transaccion: ITransaccionCreate;
}

@injectable()
export class CreditoService {
  constructor(
    @inject(CreditoRepository) private creditoRepository: CreditoRepository,
    @inject(MovimientoFinancieroRepository) private MovimientoRepository: MovimientoFinancieroRepository,
    @inject(TransactionRepository) private transaccionRepository: TransactionRepository,
    @inject(EntityRepository) private entityRepository: EntityRepository,
    @inject(CashRegisterService) private cashRegisterService: CashRegisterService,
    @inject(EntityService) private entityService: EntityService,
    @inject(HelperMapperTransaction) private helperMapperTransaction: HelperMapperTransaction
  ) {}

  async createCredito(data: Partial<ICredito>, ): Promise<ICredito> {
    try {

      data.fecheInicio = getDateInManaguaTimezone();
      data.estadoCredito = 'ABIERTO';
      data.saldoPendiente = data.saldoCredito;

      let entidad = await this.entityRepository.findById((data.entidadId as mongoose.Types.ObjectId).toString());

      if (!entidad) {
        throw new Error("Entidad no encontrada");
      }

      if (data.tipoCredito === 'VENTA') {

        let id = (entidad._id as mongoose.Types.ObjectId).toString();
        let amountReceivable = (data.saldoCredito as mongoose.Types.Decimal128);
        await this.entityRepository.updateStateClientAmountReceivable(id, amountReceivable);

      } else if (data.tipoCredito === 'COMPRA') {

        let id = (entidad._id as mongoose.Types.ObjectId).toString();
        let amountPayable = (data.saldoCredito as mongoose.Types.Decimal128);
        await this.entityRepository.updateStateClientAmountPayable(id, amountPayable);

      }

      if (data.modalidadCredito === 'PLAZO') {
        // Cálculo de la cuota mensual
        const saldoCredito = new mongoose.Types.Decimal128(data.saldoCredito?.toString() as string);
        const plazoCredito128 = new mongoose.Types.Decimal128(data.plazoCredito?.toString() as string);
        const plazoCredito = data.plazoCredito as number;
        const montoCuota = dividirDecimal128(saldoCredito, plazoCredito128)
    
        data.cuotaMensual = montoCuota
    
        // Generación de todas las cuotas
        const cuotasCredito: ICuotasCredito[] = [];
    
        for (let i = 0; i < plazoCredito; i++) {
          const fechaInicio = new Date(data.fecheInicio); // Copia de la fecha de inicio
          const fechaVencimiento = new Date(fechaInicio.setMonth(fechaInicio.getMonth() + (i + 1)));
    
          cuotasCredito.push({
            numeroCuota: i + 1,
            montoCuota: montoCuota,
            montoCapital: new mongoose.Types.Decimal128('0'), // Asumiendo que es igual al montoCuota
            fechaVencimiento: fechaVencimiento,
            estadoPago: 'PENDIENTE',
            fechaCuota: getDateInManaguaTimezone() // Fecha de creación de la cuota
          });
        }
    
        data.cuotasCredito = cuotasCredito;
      } else if (data.modalidadCredito === 'PAGO') {
        const saldoCredito = new mongoose.Types.Decimal128(data.saldoCredito?.toString() as string);
        const porcentajePagoMinimo = 0.20; // Porcentaje del 20% como ejemplo
        const nuevoPagoMinimo = multiplicarDecimal128(saldoCredito, new mongoose.Types.Decimal128(porcentajePagoMinimo.toString()));

        data.cuotasCredito = [];

        const fechaInicio = new Date(data.fecheInicio); // Copia de la fecha de inicio
        const fechaVencimiento = new Date(fechaInicio.setMonth(fechaInicio.getMonth() +  1));

        data.cuotasCredito.push({
          numeroCuota:  1,
          montoCuota: nuevoPagoMinimo,
          montoCapital: new mongoose.Types.Decimal128('0'), // Asumiendo que es igual al montoCuota
          fechaVencimiento: fechaVencimiento,
          estadoPago: 'PENDIENTE',
          fechaCuota: getDateInManaguaTimezone() // Fecha de creación de la cuota
        });

        data.pagoMinimoMensual = nuevoPagoMinimo;
      }
    
      const credito = await this.creditoRepository.create(data);


      return credito;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async handlePagoCredito({ creditoIdStr, montoPago, modalidadCredito, userId, cajaId }: IHandlePagoCreditoProps): Promise<ICredito> {
    let creditoId = new mongoose.Types.ObjectId(creditoIdStr);

    let verifyExistResumenCajaDiario = await this.cashRegisterService.verifyExistResumenCajaDiario(cajaId);

    if (!verifyExistResumenCajaDiario) {
      await this.cashRegisterService.cierreAutomatico(cajaId);
      throw new Error("Cierre de caja automatico. No se puede crear transaccion");
    }

    if (modalidadCredito === 'PLAZO') {
      return this.realizarPagoPlazo(creditoId, montoPago, userId, cajaId);
    } else {
      return this.realizarPago(creditoId, montoPago, userId, cajaId);
    }
  }

  async realizarPago(creditoId: mongoose.Types.ObjectId, montoPago: string, userId: string, cajaId: string): Promise<ICredito> {

    try {

      if (isNaN(parseFloat(montoPago))) {
        throw new Error("El monto del pago es incorrecto");
      }

      let montoPago128 = new mongoose.Types.Decimal128(parseFloat(montoPago).toFixed(2));

      const credito = await this.creditoRepository.findByIdWith(creditoId.toString());
  
      if (!credito) {
        throw new Error("Crédito no encontrado");
      }

      let venta = (await this.transaccionRepository.findTransaccionById(credito.transaccionId.toString()) as ITransaccion);

      let entidad = await this.entityRepository.findById((credito.entidadId as mongoose.Types.ObjectId).toString());

      if (!entidad) {
        throw new Error("Entidad no encontrada");
      }
    
      if (credito.modalidadCredito !== 'PAGO') {
        throw new Error("El crédito no está en modalidad de PAGO");
      }
    
      const nuevoSaldo = restarDecimal128(credito.saldoPendiente, montoPago128);
    
      if (nuevoSaldo < new mongoose.Types.Decimal128('0')) {
        throw new Error("El monto del pago excede el saldo pendiente del crédito");
      }
    
      // Actualizar el saldo del crédito
      credito.saldoPendiente = nuevoSaldo;
    
      // Registrar el pago realizado
      credito.pagosCredito.push({
        montoPago: montoPago128,
        saldoPendiente: nuevoSaldo,
        fechaPago: getDateInManaguaTimezone()
      });
    
      // Actualizar el estado de la cuota actual (la última cuota generada)
      const cuotaActual = credito.cuotasCredito[credito.cuotasCredito.length - 1];
      cuotaActual.estadoPago = 'PAGADO';

      let cero = new mongoose.Types.Decimal128('0.00');
      let isNextCredit = compareDecimal128(nuevoSaldo, cero)
    
      // Generar una nueva cuota si aún queda saldo pendiente
      if (isNextCredit) {
        const porcentajePagoMinimo = 0.20; // Porcentaje del 20% como ejemplo
        const nuevoPagoMinimo = multiplicarDecimal128(nuevoSaldo, new mongoose.Types.Decimal128(porcentajePagoMinimo.toString()));
        credito.pagoMinimoMensual = nuevoPagoMinimo;
    
        const fechaVencimiento = new Date(cuotaActual.fechaVencimiento);
        fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1); // Siguiente mes
    
        credito.cuotasCredito.push({
          numeroCuota: cuotaActual.numeroCuota + 1,
          montoCuota: nuevoPagoMinimo,
          montoCapital: nuevoPagoMinimo,
          fechaVencimiento: fechaVencimiento,
          estadoPago: 'PENDIENTE',
          fechaCuota: getDateInManaguaTimezone()
        });

        if (credito.tipoCredito === 'VENTA') {

          let id = (entidad._id as mongoose.Types.ObjectId).toString();
          let advancesReceipts = montoPago128;
          await this.entityRepository.updateStateClientAdvancesReceipts(id, advancesReceipts);
        } else if (credito.tipoCredito === 'COMPRA') {
  
          let id = (entidad._id as mongoose.Types.ObjectId).toString();
          let advancesDelivered = montoPago128
          await this.entityRepository.updateStateClientAdvancesDelivered(id, advancesDelivered);
        }

      } else {
        let montoCredito = new mongoose.Types.Decimal128(`0`);

        credito.pagosCredito.forEach(pago => {
          montoCredito = sumarDecimal128(montoCredito, pago.montoPago);   
        });

        if (credito.tipoCredito === 'VENTA') {
          (entidad.state as IClientState).advancesReceipts = sumarDecimal128((entidad.state as IClientState).advancesReceipts, montoPago128);
          (entidad.state as IClientState).amountReceivable = restarDecimal128((entidad.state as IClientState).amountReceivable, montoCredito);
          (entidad.state as IClientState).advancesReceipts = restarDecimal128((entidad.state as IClientState).advancesReceipts, montoCredito);
        } else if (credito.tipoCredito === 'COMPRA') {
          (entidad.state as IClientState).advancesDelivered = sumarDecimal128((entidad.state as IClientState).advancesDelivered, montoPago128);
          (entidad.state as IClientState).amountPayable = restarDecimal128((entidad.state as IClientState).amountPayable, montoCredito);
          (entidad.state as IClientState).advancesDelivered = restarDecimal128((entidad.state as IClientState).advancesDelivered, montoCredito);
        }

        await this.entityRepository.updateWith(credito.entidadId.toString(), entidad);

        if (venta.estadoTrasaccion === TypeEstatusTransaction.PENDIENTE) {
          credito.estadoCredito = 'CERRADO';
          venta.estadoTrasaccion = TypeEstatusTransaction.PAGADA;
        }
        await this.transaccionRepository.update(credito.transaccionId.toString(), venta);
      }
      // Guardar los cambios en la base de datos
      await this.creditoRepository.updateWith((credito._id as mongoose.Types.ObjectId).toString(), credito);

      let movimiento:Partial<IMovimientoFinanciero> = {
        fechaMovimiento: getDateInManaguaTimezone(),
        tipoMovimiento: credito.tipoCredito === 'VENTA' ? "ABONO" : "CARGO",
        monto: montoPago128,
        creditoId: (credito._id as mongoose.Types.ObjectId)
      }
      await this.MovimientoRepository.create(movimiento);

      let datosActualizar:ITransactionCreateCaja = {
        cajaId: cajaId,
        monto: Number(montoPago128),
        cambioCliente: 0,
        total: Number(montoPago128),
        tipoTransaccion: credito.tipoCredito === TypeCredito.VENTA ? TypeTransaction.VENTA : TypeTransaction.COMPRA,
        userId: userId,
        id: null
      }

      let datoMovimientoCaja:IActualizarMontoEsperadoByVenta = {
        data: datosActualizar,
      }

      await this.cashRegisterService.actualizarMontoEsperadoByTrasaccion(datoMovimientoCaja!); 
      return credito;
    } catch (error) {
      console.log(error);

      throw new Error(error.message);
    }
    
  }

  async realizarPagoPlazo(creditoId: mongoose.Types.ObjectId, montoPago: string, userId: string, cajaId: string): Promise<ICredito> {
    try {
      

      const credito = await this.creditoRepository.findByIdWith(creditoId.toString());
    
      if (!credito) {
        throw new Error("Crédito no encontrado");
      }
    
      if (credito.modalidadCredito !== 'PLAZO') {
        throw new Error("El crédito no está en modalidad de PLAZO");
      }

      let entidad = await this.entityRepository.findById((credito.entidadId as mongoose.Types.ObjectId).toString());

      if (!entidad) {
        throw new Error("Entidad no encontrada");
      }
    
      // Verificar si quedan cuotas pendientes
      const cuotaPendiente = credito.cuotasCredito.find(cuota => cuota.estadoPago === 'PENDIENTE');
      if (!cuotaPendiente) {
        throw new Error("No hay cuotas pendientes para este crédito");
      }

      if (isNaN(parseFloat(montoPago))) {
        throw new Error("El monto del pago es incorrecto");
      }
    
      // Validar el monto del pago
      const montoCuota = cuotaPendiente.montoCuota;
      let montoPago128 = new mongoose.Types.Decimal128(parseFloat(montoPago).toFixed(2));

      if (montoPago128 < montoCuota) {
        throw new Error("El monto pagado es insuficiente para cubrir la cuota");
      }
    
      // Actualizar el estado de la cuota pagada
      cuotaPendiente.estadoPago = 'PAGADO';
      cuotaPendiente.fechaCuota = getDateInManaguaTimezone(); // Fecha del pago realizado
    
      // Actualizar el saldo pendiente del crédito
      const nuevoSaldo = restarDecimal128(credito.saldoPendiente, montoCuota);
      credito.saldoPendiente = nuevoSaldo;
    
      // Registrar el pago realizado en el historial de pagos
      credito.pagosCredito.push({
        montoPago: montoPago128,
        saldoPendiente: nuevoSaldo,
        fechaPago: getDateInManaguaTimezone()
      });
    
      // Verificar si todas las cuotas han sido pagadas
      const cuotasPendientes = credito.cuotasCredito.filter(cuota => cuota.estadoPago === 'PENDIENTE');
      if (cuotasPendientes.length === 0) {
        let venta = (await this.transaccionRepository.findTransaccionById(credito.transaccionId.toString()) as ITransaccion);

        let montoCredito = new mongoose.Types.Decimal128(`0`);

        credito.pagosCredito.forEach(pago => {
          montoCredito = sumarDecimal128(montoCredito, pago.montoPago);   
        });

        if (credito.tipoCredito === 'VENTA') {
          let advancesReceipts = montoPago128;
          (entidad.state as IClientState).advancesReceipts = sumarDecimal128((entidad.state as IClientState).advancesReceipts, advancesReceipts);
          (entidad.state as IClientState).amountReceivable = restarDecimal128((entidad.state as IClientState).amountReceivable, montoCredito);
          (entidad.state as IClientState).advancesReceipts = restarDecimal128((entidad.state as IClientState).advancesReceipts, montoCredito);
        } else if (credito.tipoCredito === 'COMPRA') {
          (entidad.state as IClientState).advancesDelivered = sumarDecimal128((entidad.state as IClientState).advancesDelivered, montoPago128);
          (entidad.state as IClientState).amountPayable = restarDecimal128((entidad.state as IClientState).amountPayable, montoCredito);
          (entidad.state as IClientState).advancesDelivered = restarDecimal128((entidad.state as IClientState).advancesDelivered, montoCredito);
        }

        await this.entityRepository.updateWith(credito.entidadId.toString(), entidad);

        if (venta.estadoTrasaccion === 'PENDIENTE') {
          credito.estadoCredito = 'CERRADO';
          venta.estadoTrasaccion = TypeEstatusTransaction.PAGADA;
        }
        await this.transaccionRepository.update(credito.transaccionId.toString(), venta);
      } else {
        if (credito.tipoCredito === 'VENTA') {

          let id = (entidad._id as mongoose.Types.ObjectId).toString();
          let advancesReceipts = montoPago128;
          await this.entityRepository.updateStateClientAdvancesReceipts(id, advancesReceipts);
        } else if (credito.tipoCredito === 'COMPRA') {
  
          let id = (entidad._id as mongoose.Types.ObjectId).toString();
          let advancesDelivered = montoPago128;
          await this.entityRepository.updateStateClientAdvancesDelivered(id, advancesDelivered);
        }
      }
    
      // Guardar los cambios en la base de datos
      await this.creditoRepository.updateWith((credito._id as mongoose.Types.ObjectId).toString(), credito);

      let movimiento:Partial<IMovimientoFinanciero> = {
        fechaMovimiento: getDateInManaguaTimezone(),
        tipoMovimiento: credito.tipoCredito === 'VENTA' ? "ABONO" : "CARGO",
        monto: montoPago128,
        creditoId: (credito._id as mongoose.Types.ObjectId)
      }

      await this.MovimientoRepository.create(movimiento);

      let datosActualizar:ITransactionCreateCaja = {
        cajaId: cajaId,
        monto: Number(montoPago128),
        cambioCliente: 0,
        total: Number(montoPago128),
        tipoTransaccion: credito.tipoCredito === TypeCredito.VENTA ? TypeTransaction.VENTA : TypeTransaction.COMPRA,
        userId: userId,
        id: null
      }

      let datoMovimientoCaja:IActualizarMontoEsperadoByVenta = {
        data: datosActualizar,
      }

      await this.cashRegisterService.actualizarMontoEsperadoByTrasaccion(datoMovimientoCaja!); 

      return credito;
    } catch (error) {
      console.log(error);

      
      

      throw new Error(error.message);
    }
  }
  
  async findCreditoById(id: string): Promise<ICredito | null> {
    const credito = await this.creditoRepository.findById(id);
    return credito;
  }

  async returnTransactionById(id: string, totalDevolucion:Types.Decimal128) {
    const credito = await this.creditoRepository.findByTransactioId(id);

    if (!credito) {
      throw new Error("Crédito no encontrado");
    }

    await this.entityService.returnTransaction(credito, totalDevolucion);

    let nuevoSaldoPendiente = restarDecimal128(credito.saldoPendiente, totalDevolucion);

    let validacion = {
      diferencia: restarDecimal1282(credito.saldoPendiente, totalDevolucion),
      dineroADevolver: restarDecimal128(credito.saldoPendiente, totalDevolucion)
    };

    let dineroADevolver = cero128;

    if (compareDecimal128(cero128, validacion.diferencia)) {
      dineroADevolver = validacion.dineroADevolver;
      nuevoSaldoPendiente = cero128;

      let transaccionActualizada = {
        estadoTrasaccion: TypeEstatusTransaction.PAGADA,
      }

      await this.transaccionRepository.update(credito.transaccionId.toString(), transaccionActualizada);
    } else if (credito.modalidadCredito === 'PLAZO') {
      let countCuantoPendiente = new Types.Decimal128(credito.cuotasCredito.filter(cuota => cuota.estadoPago === 'PENDIENTE').length.toString())

      credito.cuotaMensual = dividirDecimal128(nuevoSaldoPendiente, countCuantoPendiente);
      credito.cuotasCredito.map(cuota => {
        if (cuota.estadoPago === 'PENDIENTE') {
          cuota.montoCuota = credito.cuotaMensual;
        }
      });

    } else if (credito.modalidadCredito === 'PAGO') {
      const porcentajePagoMinimo = new mongoose.Types.Decimal128("0.20");
      credito.pagoMinimoMensual = multiplicarDecimal128(nuevoSaldoPendiente, porcentajePagoMinimo);
    }

    credito.saldoPendiente = nuevoSaldoPendiente;
    credito.saldoCredito = nuevoSaldoPendiente;

    await credito.save();

    return parseInt(dineroADevolver.toString());
  }

  async findCreditoBySucursalId(sucursalId: string): Promise<ICreditoResponse[] | null> {
    const creditos = await this.creditoRepository.findBySucursalId(sucursalId) as ICredito[];

    if (!creditos) {
      throw new Error("No se encontraron creditos");
    }

    let listTransactionIdIdsSets = new Set<any>();

    creditos.forEach((credito) => {
      let id =formatObejectId((credito.transaccionId as ITransaccion)._id);
      listTransactionIdIdsSets.add(id); // Agregar a Set
    });

    const transaccionesIds = Array.from(listTransactionIdIdsSets);

    const transacciones = await this.transaccionRepository.findByIds(transaccionesIds);

    let newResponse:ICreditoResponse[] = []

    await Promise.all(
      creditos.map(async (c) => {
        let transaccionId = formatObejectId((c.transaccionId as ITransaccion)._id).toString();
        let transaccion = transacciones.find(
          (t) => formatObejectId(t._id).toString() === transaccionId
        ) as ITransaccion;
        let transaccionActualizada = await this.helperMapperTransaction.mapperData(
          transaccion,
          transaccion.transactionDetails as IDetalleTransaccion[]
        );

        newResponse.push({
          credito: c,
          transaccion: transaccionActualizada,
        });
      })
    );
    

    return newResponse;
  }

  async findAllCreditosByEntity(entidadId: string): Promise<ICredito[]> {
    const credito = await this.creditoRepository.findAllByEntity(entidadId);
    return credito;
  }

  async updateCredito(id: string, data: Partial<ICredito>): Promise<ICredito | null> {
    const credito = await this.creditoRepository.update(id, data);
    return credito;
  }

  async deleteCredito(id: string): Promise<ICredito | null> {
    const credito = await this.creditoRepository.delete(id);
    return credito;
  }
}