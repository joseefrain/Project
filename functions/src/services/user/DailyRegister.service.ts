import { inject, injectable } from 'tsyringe';
import { IDailyRegisterRepository, IDailyRegisterResponse } from '../../repositories/user/DailyRegister.repository';
import { IDailyRegister } from '../../models/usuarios/DailyRegister.model';
import { formatObejectId } from '../../gen/handleDecimal128';
import { formaterInManageTimezone, getDateInManaguaTimezone, isValidDateWithFormat, parseDate } from '../../utils/date';
import { Types } from 'mongoose';

@injectable()
export class DailyRegisterService {
  constructor(
    @inject('IDailyRegisterRepository') private repository: IDailyRegisterRepository
  ) {}

  async createDailyRegister(data: Partial<IDailyRegister>) {

    if (!data.userId && !data.hourEntry) {
      throw new Error("Se requiere el ID del usuario y la hora de ingreso");
    }

    const exists = await this.repository.existsByUserIdAndDate(
      formatObejectId(data.userId).toString()
    );
    
    if (exists) {
      throw new Error('Ya existe un registro para esta fecha');
    }

    let date = getDateInManaguaTimezone();
    let startWork = new Date(getDateInManaguaTimezone().setHours(8, 0, 0, 0));
    let endWork = new Date(getDateInManaguaTimezone().setHours(17, 0, 0, 0));

    let hourEntry = getDateInManaguaTimezone();

    const lateEntry = hourEntry > startWork;

    let note = lateEntry ? `La hora de ingreso fue después de las ${startWork.toLocaleTimeString()}` : '';

    data.startWork = startWork;
    data.endWork = endWork;
    data.lateEntry = lateEntry;
    data.note = note;
    data.date = date;
    data.hourEntry = hourEntry;

    return this.repository.create(data);
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
    startDatesStr: string,
    endDateStr: string
  ): Promise<IDailyRegister[]> {

    let startDate = parseDate(startDatesStr, 'dd-MM-yyyy');
    let endDate = parseDate(endDateStr, 'dd-MM-yyyy');

    if (!startDate || !endDate) throw new Error('Fecha no valida');

    if (!sucursalId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new Error('ID de sucursal inválido');
    }
    
    if (startDate.toJSDate() > endDate.toJSDate()) {
      throw new Error('Fecha inicial no puede ser mayor a fecha final');
    }


    return this.repository.findBySucursalAndDateRange(
      sucursalId,
      startDate.toJSDate(),
      endDate.toJSDate()
    );
  }

  async updateWorkingHours (sucursalId: string, startWork: Date, endWork: Date) {

    const result = await this.repository.updateDailyRegistersBySucursal(
      sucursalId,
      {
        startWork,
        endWork
      }
    );

    return result;
  }
}