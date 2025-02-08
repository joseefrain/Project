import { inject, injectable } from 'tsyringe';
import { IDailyRegisterRepository } from '../../repositories/user/DailyRegister.repository';
import { IDailyRegister } from '../../models/usuarios/DailyRegister.model';
import { formatObejectId } from '../../gen/handleDecimal128';
import { getDateInManaguaTimezone } from '../../utils/date';

@injectable()
export class DailyRegisterService {
  constructor(
    @inject('IDailyRegisterRepository') private repository: IDailyRegisterRepository
  ) {}

  async createDailyRegister(data: Omit<IDailyRegister, '_id' | 'lateEntry'>) {
    const exists = await this.repository.existsByUserIdAndDate(
      data.userId.toString(),
      data.date
    );
    
    if (exists) {
      throw new Error('Ya existe un registro para esta fecha');
    }

    const lateEntry = data.hourEntry > data.startWork;
    
    return this.repository.create({
      ...data,
      lateEntry
    });
  }

  async getDailyRegisterById(id: string) {
    const register = await this.repository.findById(id);
    if (!register) throw new Error('Registro no encontrado');
    return register;
  }

  async getUserRegisters(userId: string) {
    return this.repository.findAllByUserId(userId);
  }

  async updateDailyRegister(id: string, data: Partial<IDailyRegister>) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new Error('Registro no encontrado');

    const updateData: Partial<IDailyRegister> = { ...data };
    
    if (data.hourEntry) {
      updateData.lateEntry = data.hourEntry > (data.startWork || existing.startWork);
    }

    return this.repository.update(id, updateData);
  }

  async deleteDailyRegister(id: string) {
    const result = await this.repository.delete(id);
    if (!result) throw new Error('Error al eliminar el registro');
    return true;
  }

  async restoreDailyRegister(id: string) {
    const result = await this.repository.restore(id);
    if (!result) throw new Error('Error al restaurar el registro');
    return true;
  }

  async markExit(userId: string): Promise<IDailyRegister> {
    const register = await this.repository.findCheckOutTime(userId);

    if (!register) {
      throw new Error('No existe un registro activo para hoy');
    }

    const updated = await this.repository.markExit(formatObejectId(register._id).toString(), getDateInManaguaTimezone());
    if (!updated) throw new Error('Error al registrar la salida');
    
    return updated;
  }

  async getBySucursalAndDateRange(
    sucursalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<IDailyRegister[]> {
    if (!sucursalId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new Error('ID de sucursal inválido');
    }
    
    if (startDate > endDate) {
      throw new Error('Fecha inicial no puede ser mayor a fecha final');
    }

    return this.repository.findBySucursalAndDateRange(
      sucursalId,
      startDate,
      endDate
    );
  }
}