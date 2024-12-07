import mongoose from "mongoose";
import { parse } from "path";
import { ICredito, ICuotasCredito, ModalidadCredito } from "../../models/credito/Credito.model";
import { IMovimientoFinanciero } from "../../models/credito/MovimientoFinanciero.model";
import { CreditoRepository } from "../../repositories/credito/Credito.repository";
import { MovimientoFinancieroRepository } from "../../repositories/credito/MovimientoFinanciero.repository";
import { inject, injectable } from "tsyringe";
import { VentaRepository } from "../../repositories/venta/venta.repository";
import { ITransaccion } from "../../models/Ventas/Venta.model";
import { EntityRepository } from "../../repositories/entity/Entity.repository";
import { dividirDecimal128, multiplicarDecimal128, restarDecimal128, sumarDecimal128 } from "../../gen/handleDecimal128";
import { IClientState } from "../../models/entity/Entity.model";

@injectable()
export class CreditoService {
  constructor(
    @inject(CreditoRepository) private creditoRepository: CreditoRepository,
    @inject(MovimientoFinancieroRepository) private MovimientoRepository: MovimientoFinancieroRepository,
    @inject(VentaRepository) private ventaRepository: VentaRepository,
    @inject(EntityRepository) private entityRepository: EntityRepository,
  ) {}

  async createCredito(data: Partial<ICredito>, session: mongoose.mongo.ClientSession): Promise<ICredito> {
    try {

      data.fecheInicio = new Date();
      data.estadoCredito = 'ABIERTO';
      data.saldoPendiente = data.saldoCredito;

      let entidad = await this.entityRepository.findById((data.entidadId as mongoose.Types.ObjectId).toString());

      if (!entidad) {
        throw new Error("Entidad no encontrada");
      }

      if (data.tipoCredito === 'VENTA') {

        let id = (entidad._id as mongoose.Types.ObjectId).toString();
        let amountReceivable = (data.saldoCredito as mongoose.Types.Decimal128);
        await this.entityRepository.updateStateClientAmountReceivable(id, amountReceivable, session);

      } else if (data.tipoCredito === 'COMPRA') {

        let id = (entidad._id as mongoose.Types.ObjectId).toString();
        let amountPayable = (data.saldoCredito as mongoose.Types.Decimal128);
        await this.entityRepository.updateStateClientAmountPayable(id, amountPayable, session);

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
            fechaCuota: new Date() // Fecha de creación de la cuota
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
          fechaCuota: new Date() // Fecha de creación de la cuota
        });

        data.pagoMinimoMensual = nuevoPagoMinimo;
      }
    
      const credito = await this.creditoRepository.create(data, session);


      return credito;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async handlePagoCredito(creditoIdStr: string, montoPago: number, modalidadCredito: ModalidadCredito): Promise<ICredito> {
    let creditoId = new mongoose.Types.ObjectId(creditoIdStr);

    if (modalidadCredito === 'PLAZO') {
      return this.realizarPagoPlazo(creditoId, montoPago);
    } else {
      return this.realizarPago(creditoId, montoPago);
    }
  }

  async realizarPago(creditoId: mongoose.Types.ObjectId, montoPago: number): Promise<ICredito> {

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      let montoPago128 = new mongoose.Types.Decimal128(montoPago.toString());

      const credito = await this.creditoRepository.findByIdWithSession(creditoId.toString(), session);
  
      if (!credito) {
        throw new Error("Crédito no encontrado");
      }

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
        fechaPago: new Date()
      });
    
      // Actualizar el estado de la cuota actual (la última cuota generada)
      const cuotaActual = credito.cuotasCredito[credito.cuotasCredito.length - 1];
      cuotaActual.estadoPago = 'PAGADO';

      let cero = new mongoose.Types.Decimal128('0.00');
      let isNextCredit = nuevoSaldo > cero
    
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
          fechaCuota: new Date()
        });

        if (credito.tipoCredito === 'VENTA') {

          let id = (entidad._id as mongoose.Types.ObjectId).toString();
          let advancesReceipts = montoPago128;
          await this.entityRepository.updateStateClientAdvancesReceipts(id, advancesReceipts, session);
        } else if (credito.tipoCredito === 'COMPRA') {
  
          let id = (entidad._id as mongoose.Types.ObjectId).toString();
          let advancesDelivered = montoPago128
          await this.entityRepository.updateStateClientAdvancesDelivered(id, advancesDelivered, session);
        }

      } else {
        let venta = (await this.ventaRepository.findVentaById(credito.transaccionId.toString()) as ITransaccion);

        let montoCredito = new mongoose.Types.Decimal128(`0`);

        credito.pagosCredito.forEach(pago => {
          montoCredito = sumarDecimal128(montoCredito, pago.montoPago);   
        });

        if (credito.tipoCredito === 'VENTA') {
          (entidad.state as IClientState).advancesReceipts = sumarDecimal128((entidad.state as IClientState).advancesReceipts, montoPago128);
          (entidad.state as IClientState).amountReceivable = restarDecimal128((entidad.state as IClientState).amountReceivable, montoCredito);
          (entidad.state as IClientState).advancesReceipts = restarDecimal128((entidad.state as IClientState).advancesReceipts, montoCredito);
        } else if (credito.tipoCredito === 'COMPRA') {
          (entidad.state as IClientState).amountPayable = restarDecimal128((entidad.state as IClientState).amountPayable, montoCredito);
          (entidad.state as IClientState).advancesDelivered = restarDecimal128((entidad.state as IClientState).advancesDelivered, montoCredito);
        }

        await this.entityRepository.updateWithSession(credito.entidadId.toString(), entidad, session);

        if (venta.estadoTrasaccion === 'PENDIENTE') {
          credito.estadoCredito = 'CERRADO';
          venta.estadoTrasaccion = 'PAGADA';
        }
        await this.ventaRepository.update(credito.transaccionId.toString(), venta, session);
      }
      // Guardar los cambios en la base de datos
      await this.creditoRepository.updateWithSession((credito._id as mongoose.Types.ObjectId).toString(), credito, session);

      let movimiento:Partial<IMovimientoFinanciero> = {
        fechaMovimiento: new Date(),
        tipoMovimiento: credito.tipoCredito === 'VENTA' ? "ABONO" : "CARGO",
        monto: montoPago128,
        creditoId: (credito._id as mongoose.Types.ObjectId)
      }

      await this.MovimientoRepository.create(movimiento, session);

      await session.commitTransaction();
      session.endSession();

      return credito;
    } catch (error) {
      console.log(error);

      await session.abortTransaction();
      session.endSession();

      throw new Error(error.message);
    }
    
  }

  async realizarPagoPlazo(creditoId: mongoose.Types.ObjectId, montoPago: number): Promise<ICredito> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const credito = await this.creditoRepository.findByIdWithSession(creditoId.toString(), session);
    
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
    
      // Validar el monto del pago
      const montoCuota = cuotaPendiente.montoCuota;
      if (new mongoose.Types.Decimal128(montoPago.toString()) < montoCuota) {
        throw new Error("El monto pagado es insuficiente para cubrir la cuota");
      }
    
      // Actualizar el estado de la cuota pagada
      cuotaPendiente.estadoPago = 'PAGADO';
      cuotaPendiente.fechaCuota = new Date(); // Fecha del pago realizado
    
      // Actualizar el saldo pendiente del crédito
      const nuevoSaldo = restarDecimal128(credito.saldoPendiente, montoCuota);
      credito.saldoPendiente = nuevoSaldo;
    
      // Registrar el pago realizado en el historial de pagos
      credito.pagosCredito.push({
        montoPago: new mongoose.Types.Decimal128(montoPago.toFixed(2)),
        saldoPendiente: nuevoSaldo,
        fechaPago: new Date()
      });
    
      // Verificar si todas las cuotas han sido pagadas
      const cuotasPendientes = credito.cuotasCredito.filter(cuota => cuota.estadoPago === 'PENDIENTE');
      if (cuotasPendientes.length === 0) {
        let venta = (await this.ventaRepository.findVentaById(credito.transaccionId.toString()) as ITransaccion);

        let montoCredito = new mongoose.Types.Decimal128(`0`);

        credito.pagosCredito.forEach(pago => {
          montoCredito = sumarDecimal128(montoCredito, pago.montoPago);   
        });

        if (credito.tipoCredito === 'VENTA') {
          let advancesReceipts = new mongoose.Types.Decimal128(montoPago.toFixed(2));
          (entidad.state as IClientState).advancesReceipts = sumarDecimal128((entidad.state as IClientState).advancesReceipts, advancesReceipts);
          (entidad.state as IClientState).amountReceivable = restarDecimal128((entidad.state as IClientState).amountReceivable, montoCredito);
          (entidad.state as IClientState).advancesReceipts = restarDecimal128((entidad.state as IClientState).advancesReceipts, montoCredito);
        } else if (credito.tipoCredito === 'COMPRA') {
          (entidad.state as IClientState).amountPayable = restarDecimal128((entidad.state as IClientState).amountPayable, montoCredito);
          (entidad.state as IClientState).advancesDelivered = restarDecimal128((entidad.state as IClientState).advancesDelivered, montoCredito);
        }

        await this.entityRepository.updateWithSession(credito.entidadId.toString(), entidad, session);

        if (venta.estadoTrasaccion === 'PENDIENTE') {
          credito.estadoCredito = 'CERRADO';
          venta.estadoTrasaccion = 'PAGADA';
        }
        await this.ventaRepository.update(credito.transaccionId.toString(), venta, session);
      } else {
        if (credito.tipoCredito === 'VENTA') {

          let id = (entidad._id as mongoose.Types.ObjectId).toString();
          let advancesReceipts = new mongoose.Types.Decimal128(montoPago.toFixed(2));
          await this.entityRepository.updateStateClientAdvancesReceipts(id, advancesReceipts, session);
        } else if (credito.tipoCredito === 'COMPRA') {
  
          let id = (entidad._id as mongoose.Types.ObjectId).toString();
          let advancesDelivered = new mongoose.Types.Decimal128(montoPago.toFixed(2));
          await this.entityRepository.updateStateClientAdvancesDelivered(id, advancesDelivered, session);
        }
      }
    
      // Guardar los cambios en la base de datos
      await this.creditoRepository.updateWithSession((credito._id as mongoose.Types.ObjectId).toString(), credito, session);

      let movimiento:Partial<IMovimientoFinanciero> = {
        fechaMovimiento: new Date(),
        tipoMovimiento: credito.tipoCredito === 'VENTA' ? "ABONO" : "CARGO",
        monto: new mongoose.Types.Decimal128(montoPago.toFixed(2)),
        creditoId: (credito._id as mongoose.Types.ObjectId)
      }

      await this.MovimientoRepository.create(movimiento, session);

      await session.commitTransaction();
      session.endSession();

      return credito;
    } catch (error) {
      console.log(error);

      await session.abortTransaction();
      session.endSession();

      throw new Error(error.message);
    }
  }
  
  async findCreditoById(id: string): Promise<ICredito | null> {
    const credito = await this.creditoRepository.findById(id);
    return credito;
  }

  async findCreditoBySucursalId(sucursalId: string): Promise<ICredito[] | null> {
    const credito = await this.creditoRepository.findBySucursalId(sucursalId);
    return credito;
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