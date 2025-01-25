import { inject, injectable } from 'tsyringe';
import { IClientState, IEntity } from '../../models/entity/Entity.model';
import { EntityRepository } from '../../repositories/entity/Entity.repository';
import mongoose, { Types } from 'mongoose';
import { ICredito } from '../../models/credito/Credito.model';
import { cero128, restarDecimal128, restarDecimal1282 } from '../../gen/handleDecimal128';

@injectable()
export class EntityService {
  constructor(@inject(EntityRepository) private repository: EntityRepository) {}

  async createEntity(data: Partial<IEntity>): Promise<IEntity> {
    const entityExists = await this.repository.findByIdentification(
      data.generalInformation?.identificationNumber!
    );

    if (entityExists) {
      throw new Error('Entity already exists for identificationNumber');
    }

    let state:IClientState = {
      amountReceivable: new mongoose.Types.Decimal128('0'),
      advancesReceipts: new mongoose.Types.Decimal128('0'),
      advancesDelivered: new mongoose.Types.Decimal128('0'),
      amountPayable: new mongoose.Types.Decimal128('0'),
    }

    data.state = state;

    const newEntity = await this.repository.create(data);
    return newEntity;
  }

  async getEntityById(id: string): Promise<IEntity | null> {
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new Error('Entity not found');
    }
    return entity;
  }

  async returnTransaction(credito:ICredito, montoDevolucion:Types.Decimal128) {

    let entidad = await this.getEntityById((credito.entidadId as Types.ObjectId).toString());
    if (!entidad) {
      throw new Error('Entity not found');

    }

    if (credito.tipoCredito === 'VENTA') {
      const saldoPendiente = credito.saldoPendiente;
      const saldoAbonado = restarDecimal128(credito.saldoCredito, saldoPendiente);

      const clienteState = entidad.state as IClientState;
    
      // Ajustar amountReceivable (saldo pendiente)
      let nuevoSaldoPendienteCredito = restarDecimal1282(saldoPendiente, montoDevolucion);
      if (nuevoSaldoPendienteCredito < cero128) {
        nuevoSaldoPendienteCredito = cero128; // No puede ser negativo
      }
    
      // Ajustar advancesReceipts (anticipos recibidos)
      let montoDevolucionPagada = montoDevolucion > saldoAbonado ? saldoAbonado : montoDevolucion // Solo afecta lo ya pagado
      let nuevoSaldoAbonadoCredito = restarDecimal128(saldoAbonado, montoDevolucionPagada)

      const ajusteAmountReceivable = restarDecimal128(saldoPendiente, nuevoSaldoPendienteCredito) // Cuánto disminuye el saldo pendiente global
      const ajusteAdvancesReceipts = restarDecimal128(saldoAbonado, nuevoSaldoAbonadoCredito) 
    
      // Actualizar valores globales del cliente
      const nuevoAmountReceivable = restarDecimal128(clienteState.amountReceivable, ajusteAmountReceivable);
      const nuevoAdvancesReceipts = restarDecimal128(clienteState.advancesReceipts, ajusteAdvancesReceipts)
    
      // Devolver los nuevos valores en Decimal128
      clienteState.amountReceivable = nuevoAmountReceivable;
      clienteState.advancesReceipts = nuevoAdvancesReceipts;

      entidad.state = {...entidad.state,...clienteState};
    } else {
      const saldoPendiente = credito.saldoPendiente;
      const saldoAbonado = restarDecimal128(credito.saldoCredito, saldoPendiente);

      const clienteState = entidad.state as IClientState;

      // Ajustar amountPayable (saldo pendiente)
      let nuevoSaldoPendienteCredito = restarDecimal1282(saldoPendiente, montoDevolucion);
      if (nuevoSaldoPendienteCredito < cero128) {
        nuevoSaldoPendienteCredito = cero128; // No puede ser negativo
      }

      // Ajustar advancesDelivered (anticipos entregados)
      let montoDevolucionPagada = montoDevolucion > saldoAbonado ? saldoAbonado : montoDevolucion // Solo afecta lo ya pagado
      let nuevoSaldoAbonadoCredito = restarDecimal128(saldoAbonado, montoDevolucionPagada)
      if (nuevoSaldoAbonadoCredito < cero128) {
        nuevoSaldoAbonadoCredito = cero128; // No puede ser negativo
      }

      // Actualizar valores globales del cliente
      const nuevoAmountPayable = restarDecimal128(clienteState.amountPayable, restarDecimal128(saldoPendiente, nuevoSaldoPendienteCredito));
      const nuevoAdvancesDelivered = restarDecimal128(clienteState.advancesDelivered, montoDevolucionPagada)

      // Devolver los nuevos valores en Decimal128
      clienteState.amountPayable = nuevoAmountPayable;
      clienteState.advancesDelivered = nuevoAdvancesDelivered;

      entidad.state = {...entidad.state,...clienteState};
    }

    await entidad.save();
  }

  async getAllEntities(
    filters: any,
    limit: number,
    skip: number
  ): Promise<IEntity[]> {
    return this.repository.findAll(filters, limit, skip);
  }

  async updateEntity(
    id: string,
    data: Partial<IEntity>
  ): Promise<IEntity | null> {
    const entity = await this.repository.update(id, data);
    if (!entity) {
      throw new Error('Entity not found');
    }
    return entity;
  }

  async deleteEntity(id: string): Promise<IEntity | null> {
    const entity = await this.repository.delete(id);
    if (!entity) {
      throw new Error('Entity not found');
    }
    return entity;
  }
}
