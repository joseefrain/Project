import { injectable } from 'tsyringe';
import { DailyRegisterModel, IDailyRegister } from '../../models/usuarios/DailyRegister.model';
import { Types } from 'mongoose';
import { getDateInManaguaTimezone } from '../../utils/date';

export interface IDailyRegisterRepository {
  create(dailyRegister: Omit<IDailyRegister, '_id'>): Promise<IDailyRegister>;
  findById(id: string): Promise<IDailyRegister | null>;
  findAllByUserId(userId: string): Promise<IDailyRegister[]>;
  update(id: string, data: Partial<IDailyRegister>): Promise<IDailyRegister | null>;
  delete(id: string): Promise<boolean>;
  restore(id: string): Promise<boolean>;
  existsByUserIdAndDate(userId: string, date: Date): Promise<boolean>;
  markExit(id: string, exitTime: Date): Promise<IDailyRegister | null>;
  findBySucursalAndDateRange(
    sucursalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<IDailyRegister[]>;
  findCheckOutTime(userId: string): Promise<IDailyRegister | null>;
}

@injectable()
export class DailyRegisterRepository implements IDailyRegisterRepository {
  async create(dailyRegister: Omit<IDailyRegister, '_id'>): Promise<IDailyRegister> {
    return DailyRegisterModel.create(dailyRegister);
  }

  async findById(id: string): Promise<IDailyRegister | null> {
    return DailyRegisterModel.findOne({ _id: id, deleted_at: null });
  }

  async findAllByUserId(userId: string): Promise<IDailyRegister[]> {
    return DailyRegisterModel.find({ userId, deleted_at: null });
  }

  async findCheckOutTime(userId: string): Promise<IDailyRegister | null> {

    const today = getDateInManaguaTimezone();
    today.setHours(0, 0, 0, 0);

    return DailyRegisterModel.findOne({ userId, deleted_at: null, date: { $gte: today }, hourExit: null });
  }

  async update(id: string, data: Partial<IDailyRegister>): Promise<IDailyRegister | null> {
    return DailyRegisterModel.findByIdAndUpdate(
      id,
      { ...data, $unset: { deleted_at: 1 } },
      { new: true }
    );
  }

  async delete(id: string): Promise<boolean> {
    const result = await DailyRegisterModel.findByIdAndUpdate(
      id,
      { deleted_at: getDateInManaguaTimezone() }
    );
    return !!result;
  }

  async restore(id: string): Promise<boolean> {
    const result = await DailyRegisterModel.findByIdAndUpdate(
      id,
      { deleted_at: null }
    );
    return !!result;
  }

  async existsByUserIdAndDate(userId: string, date: Date): Promise<boolean> {
    const count = await DailyRegisterModel.countDocuments({ userId, date });
    return count > 0;
  }

  async markExit(id: string, exitTime: Date): Promise<IDailyRegister | null> {
    return DailyRegisterModel.findByIdAndUpdate(
      id,
      { hourExit: exitTime },
      { new: true }
    );
  }

  async findBySucursalAndDateRange(
    sucursalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<IDailyRegister[]> {
    return DailyRegisterModel.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $match: {
          'user.sucursalId': new Types.ObjectId(sucursalId),
          date: { $gte: startDate, $lte: endDate },
          deleted_at: null
        }
      },
      { $project: { user: 0 } } // Excluir los datos del usuario
    ]);
  }
}