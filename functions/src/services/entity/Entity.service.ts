import { inject, injectable } from 'tsyringe';
import { IClientState, IEntity } from '../../models/entity/Entity.model';
import { EntityRepository } from '../../repositories/entity/Entity.repository';
import mongoose, { Types } from 'mongoose';
import { ICredito } from '../../models/credito/Credito.model';
import { cero128, compareDecimal128, compareToCero, restarDecimal128, restarDecimal1282 } from '../../gen/handleDecimal128';
import { TransactionRepository } from '../../repositories/transaction/transaction.repository';

@injectable()
export class EntityService {
  constructor(@inject(EntityRepository) private repository: EntityRepository, @inject(TransactionRepository) private transactionRepository: TransactionRepository) {}

  async createEntity(data: Partial<IEntity>): Promise<IEntity> {
    // const entityExists = await this.repository.findByIdentification(
    //   data.generalInformation?.identificationNumber!
    // );

    // if (entityExists) {
    //   throw new Error('Entity already exists for identificationNumber');
    // }

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

    const saldoPendiente = credito.saldoPendiente;
      const saldoAbonado = restarDecimal128(credito.saldoCredito, saldoPendiente);

      const clienteState = entidad.state as IClientState;

    if (credito.tipoCredito === 'VENTA') {
      /* *** LOGICA DE AJUSTAR ESTADO FINANCIERO DEL CLIENTE *** */
      if (compareDecimal128(montoDevolucion, saldoPendiente)) {
        clienteState.advancesReceipts = restarDecimal128(clienteState.advancesReceipts, saldoAbonado);
        clienteState.amountReceivable = restarDecimal128(clienteState.amountReceivable, saldoPendiente);
      } else {
        clienteState.amountReceivable = restarDecimal128(clienteState.amountReceivable, montoDevolucion);
      }

      entidad.state = {...entidad.state,...clienteState};
    } else {
      // Ajustar amountPayable (saldo pendiente)
      if (compareDecimal128(montoDevolucion, saldoPendiente)) {
        clienteState.advancesDelivered = restarDecimal128(clienteState.advancesDelivered, saldoAbonado);
        clienteState.amountPayable = restarDecimal128(clienteState.amountPayable, saldoPendiente);
      } else {
        clienteState.amountPayable = restarDecimal128(clienteState.amountPayable, montoDevolucion);
      }
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
    let count = await this.transactionRepository.countByEntity(id);
    if (count) {
      throw new Error('La entidad tiene transacciones pendientes');
    }
    const entity = await this.repository.delete(id);
    if (!entity) {
      throw new Error('Entity not found');
    }
    return entity;
  }
}
