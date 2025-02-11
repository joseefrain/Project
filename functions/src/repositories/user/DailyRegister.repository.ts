import { injectable } from 'tsyringe';
import { DailyRegisterModel, IDailyRegister } from '../../models/usuarios/DailyRegister.model';
import mongoose, { Types } from 'mongoose';
import { getDateInManaguaTimezone, useTodayDateRange } from '../../utils/date';
import { IUser, User } from '../../models/usuarios/User.model';

export interface IDailyRegisterResponse extends Partial<IUser> {
  registers: IDailyRegister[];
}

export interface IDailyRegisterRepository {
  create(dailyRegister: Partial<IDailyRegister>): Promise<IDailyRegister>;
  findById(id: string): Promise<IDailyRegister | null>;
  findAllByUserId(userId: string): Promise<IDailyRegister[]>;
  update(id: string, data: Partial<IDailyRegister>): Promise<IDailyRegister | null>;
  delete(id: string): Promise<boolean>;
  restore(id: string): Promise<boolean>;
  existsByUserIdAndDate(userId: string): Promise<boolean>;
  markExit(id: string, exitTime: Date): Promise<IDailyRegister | null>;
  findBySucursalAndDateRange(
    sucursalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<IDailyRegister[]>;
  findCheckOutTime(userId: string): Promise<IDailyRegister | null>;
  updateDailyRegistersBySucursal(sucursalId: string, updateData: Partial<IDailyRegister>)
}

@injectable()
export class DailyRegisterRepository implements IDailyRegisterRepository {

  private model: typeof DailyRegisterModel;
  private userModel: typeof User;
  
    constructor() {
      this.model = DailyRegisterModel;
      this.userModel = User;
    }

  async create(dailyRegister: Partial<IDailyRegister>): Promise<IDailyRegister> {
    return DailyRegisterModel.create(dailyRegister);
  }

  async findById(id: string): Promise<IDailyRegister | null> {
    return DailyRegisterModel.findOne({ _id: id, deleted_at: null });
  }

  async findAllByUserId(userId: string): Promise<IDailyRegister[]> {
    return DailyRegisterModel.find({ userId, deleted_at: null });
  }

  async findCheckOutTime(userId: string): Promise<IDailyRegister | null> {

    const [startDateISO, endDateISO] = useTodayDateRange()

    console.log(startDateISO, endDateISO)

    let registers = await this.model.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          date: { $gte: startDateISO, $lte: endDateISO },
          deleted_at: null,
          hourExit: null,
        },
      },
    ]);

    // const register = await DailyRegisterModel.findOne({ userId, date: { $gte: new Date(startDateISO), $lte: new Date(endDateISO) }, hourExit: null, deleted_at: null });
    return registers.length > 0 ? registers[0] : null;

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

  async existsByUserIdAndDate(userId: string): Promise<boolean> {

    const [startDateISO, endDateISO] = useTodayDateRange()

    const count = await DailyRegisterModel.countDocuments({ userId, date: { $gte: startDateISO, $lte: endDateISO } });
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

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 0);


    let registers = await this.model.aggregate([
      {
        $match: {
          
          date: { $gte: startDate, $lte: endDate },
          deleted_at: null
        },
      },
      {
        $lookup: {
          from: 'users', // Asegúrate del nombre correcto
          localField: 'userId',
          foreignField: '_id',
          as: 'userId'
        }
      },
      { $unwind: { path: '$userId', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          'userId.sucursalId': { $eq: new Types.ObjectId(sucursalId) },
        }
      },
    ]);


    return registers;
  }

async updateDailyRegistersBySucursal(sucursalId: string, updateData: Partial<IDailyRegister>) {
  try {
    // 1️⃣ Buscar todos los usuarios con el `sucursalId`
    const users = await this.userModel.find({ sucursalId: new Types.ObjectId(sucursalId) }).select("_id");

    // 2️⃣ Extraer los `userId`
    const userIds = users.map(user => (user._id as mongoose.Types.ObjectId).toString());

    if (userIds.length === 0) {
      console.log("No se encontraron usuarios para esta sucursal.");
      return;
    }

    const [startDateISO, endDateISO] = useTodayDateRange()

    // 3️⃣ Actualizar los registros en `IDailyRegister`
    const result = await DailyRegisterModel.updateMany(
      {
        date: {
          $gte: startDateISO,
          $lte: endDateISO
        },
        userId: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) } 
      },
      { $set: updateData }           // Datos a actualizar
    );

    return result;

  } catch (error) {
    console.error("Error actualizando registros:", error);
  }
}

}