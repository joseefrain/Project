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
import { restarDecimal128, sumarDecimal128 } from "../../gen/handleDecimal128";
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
        const saldoCredito = parseFloat((data.saldoCredito?.toString() as string));
        const plazoCredito = data.plazoCredito as number;
        const montoCuota = saldoCredito / plazoCredito;
    
        data.cuotaMensual = new mongoose.Types.Decimal128(montoCuota.toFixed(2));
    
        // Generación de todas las cuotas
        const cuotasCredito: ICuotasCredito[] = [];
    
        for (let i = 0; i < plazoCredito; i++) {
          const fechaInicio = new Date(data.fecheInicio); // Copia de la fecha de inicio
          const fechaVencimiento = new Date(fechaInicio.setMonth(fechaInicio.getMonth() + i));
    
          cuotasCredito.push({
            numeroCuota: i + 1,
            montoCuota: new mongoose.Types.Decimal128(montoCuota.toFixed(2)),
            montoCapital: new mongoose.Types.Decimal128('0'), // Asumiendo que es igual al montoCuota
            fechaVencimiento: fechaVencimiento,
            estadoPago: 'PENDIENTE',
            fechaCuota: new Date() // Fecha de creación de la cuota
          });
        }
    
        data.cuotasCredito = cuotasCredito;
      } else if (data.modalidadCredito === 'PAGO') {
        const saldoCredito = parseFloat((data.saldoCredito?.toString() as string));
        const porcentajePagoMinimo = 0.20; // Porcentaje del 20% como ejemplo
        const nuevoPagoMinimo = saldoCredito * porcentajePagoMinimo;

        data.pagoMinimoMensual = new mongoose.Types.Decimal128(nuevoPagoMinimo.toFixed(2));
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
    
      const saldoPendiente = parseFloat((credito.saldoCredito.toString() as string));
      const nuevoSaldo = saldoPendiente - montoPago;
    
      if (nuevoSaldo < 0) {
        throw new Error("El monto del pago excede el saldo pendiente del crédito");
      }
    
      // Actualizar el saldo del crédito
      credito.saldoCredito = new mongoose.Types.Decimal128(nuevoSaldo.toFixed(2));
    
      // Registrar el pago realizado
      credito.pagosCredito.push({
        montoPago: new mongoose.Types.Decimal128(montoPago.toFixed(2)),
        saldoPendiente: new mongoose.Types.Decimal128(nuevoSaldo.toFixed(2)),
        fechaPago: new Date()
      });
    
      // Actualizar el estado de la cuota actual (la última cuota generada)
      const cuotaActual = credito.cuotasCredito[credito.cuotasCredito.length - 1];
      cuotaActual.estadoPago = 'PAGADO';
    
      // Generar una nueva cuota si aún queda saldo pendiente
      if (nuevoSaldo > 0) {
        const porcentajePagoMinimo = 0.20; // Porcentaje del 20% como ejemplo
        const nuevoPagoMinimo = nuevoSaldo * porcentajePagoMinimo;
        credito.pagoMinimoMensual = new mongoose.Types.Decimal128(nuevoPagoMinimo.toFixed(2));
    
        const fechaVencimiento = new Date(cuotaActual.fechaVencimiento);
        fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1); // Siguiente mes
    
        credito.cuotasCredito.push({
          numeroCuota: cuotaActual.numeroCuota + 1,
          montoCuota: new mongoose.Types.Decimal128(nuevoPagoMinimo.toFixed(2)),
          montoCapital: new mongoose.Types.Decimal128(nuevoPagoMinimo.toFixed(2)),
          fechaVencimiento: fechaVencimiento,
          estadoPago: 'PENDIENTE',
          fechaCuota: new Date()
        });

        if (credito.tipoCredito === 'VENTA') {

          let id = (entidad._id as mongoose.Types.ObjectId).toString();
          let advancesReceipts = new mongoose.Types.Decimal128(montoPago.toFixed(2));
          await this.entityRepository.updateStateClientAdvancesReceipts(id, advancesReceipts, session);
        } else if (credito.tipoCredito === 'COMPRA') {
  
          let id = (entidad._id as mongoose.Types.ObjectId).toString();
          let advancesDelivered = new mongoose.Types.Decimal128(montoPago.toFixed(2));
          await this.entityRepository.updateStateClientAdvancesDelivered(id, advancesDelivered, session);
        }

      } else {
        let venta = (await this.ventaRepository.findVentaById(credito.transaccionId.toString()) as ITransaccion);

        let montoCredito = new mongoose.Types.Decimal128(`0`);

        credito.pagosCredito.forEach(pago => {
          montoCredito = sumarDecimal128(montoCredito, pago.montoPago);   
        });

        if (credito.tipoCredito === 'VENTA') {
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
    
      // Verificar si quedan cuotas pendientes
      const cuotaPendiente = credito.cuotasCredito.find(cuota => cuota.estadoPago === 'PENDIENTE');
      if (!cuotaPendiente) {
        throw new Error("No hay cuotas pendientes para este crédito");
      }
    
      // Validar el monto del pago
      const montoCuota = parseFloat(cuotaPendiente.montoCuota.toString());
      if (montoPago < montoCuota) {
        throw new Error("El monto pagado es insuficiente para cubrir la cuota");
      }
    
      // Actualizar el estado de la cuota pagada
      cuotaPendiente.estadoPago = 'PAGADO';
      cuotaPendiente.fechaCuota = new Date(); // Fecha del pago realizado
    
      // Actualizar el saldo pendiente del crédito
      const saldoActual = parseFloat(credito.saldoCredito.toString());
      const nuevoSaldo = saldoActual - montoCuota;
      credito.saldoCredito = new mongoose.Types.Decimal128(nuevoSaldo.toFixed(2));
    
      // Registrar el pago realizado en el historial de pagos
      credito.pagosCredito.push({
        montoPago: new mongoose.Types.Decimal128(montoPago.toFixed(2)),
        saldoPendiente: new mongoose.Types.Decimal128(nuevoSaldo.toFixed(2)),
        fechaPago: new Date()
      });
    
      // Verificar si todas las cuotas han sido pagadas
      const cuotasPendientes = credito.cuotasCredito.filter(cuota => cuota.estadoPago === 'PENDIENTE');
      if (cuotasPendientes.length === 0) {
        // Si no quedan cuotas pendientes, cerrar el crédito
        credito.estadoCredito = 'CERRADO';
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