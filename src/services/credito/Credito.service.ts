import { ICredito } from "src/models/credito/Credito.model";
import { CreditoRepository } from "src/repositories/credito/Credito.repository";
import { MovimientoFinancieroRepository } from "src/repositories/credito/MovimientoFinanciero.repository";
import { inject, injectable } from "tsyringe";

@injectable()
export class TrasladoService {
  constructor(
    @inject(CreditoRepository) private creditoRepository: CreditoRepository,
    @inject(MovimientoFinancieroRepository) private MovimientoRepository: MovimientoFinancieroRepository,
  ) {}

  async createCredito(data: Partial<ICredito>): Promise<ICredito> {
    const credito = await this.creditoRepository.create(data);
    return credito;
  }

  async findCreditoById(id: string): Promise<ICredito | null> {
    const credito = await this.creditoRepository.findById(id);
    return credito;
  }

  async findAllCreditos(
    filters: any = {},
    limit: number = 10,
    skip: number = 0
  ): Promise<ICredito[]> {
    const credito = await this.creditoRepository.findAll(filters, limit, skip);
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