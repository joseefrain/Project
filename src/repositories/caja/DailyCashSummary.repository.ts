import mongoose, { Model, FilterQuery, Types, mongo } from 'mongoose';
import ResumenCajaDiario, { IResumenCajaDiario } from '../../models/cashRegister/DailyCashSummary.model';
import { IAddExpenseDailySummary, IAddIncomeDailySummary, IVentaCreateCaja } from '../../interface/ICaja';

export class ResumenCajaDiarioRepository {
  private model: Model<IResumenCajaDiario>;

  constructor() {
    this.model = ResumenCajaDiario;
  }

  // Método para crear un nuevo resumen de caja diario
  async create(data: Partial<IResumenCajaDiario>, session: mongo.ClientSession): Promise<IResumenCajaDiario> {
    try {
      const resumen = new this.model(data);
      return await resumen.save({ session });
    } catch (error) {
      throw new Error(`Error al crear ResumenCajaDiario: ${error.message}`);
    }
  }

  // Método para obtener un resumen por ID
  async findById(id: string): Promise<IResumenCajaDiario | null> {
    try {
      return await this.model.findById(id).populate('sucursalId ventas.userId ventas.sucursalId').exec();
    } catch (error) {
      throw new Error(`Error al obtener ResumenCajaDiario por ID: ${error.message}`);
    }
  }

  // Método para obtener todos los resúmenes con filtros opcionales y paginación
  async findAll(
    filters: FilterQuery<IResumenCajaDiario> = {},
    limit: number = 10,
    skip: number = 0
  ): Promise<IResumenCajaDiario[]> {
    try {
      return await this.model.find(filters)
        .populate('sucursalId ventas.userId ventas.sucursalId')
        .limit(limit)
        .skip(skip)
        .exec();
    } catch (error) {
      throw new Error(`Error al obtener resúmenes de caja: ${error.message}`);
    }
  }

  // Método para actualizar un resumen por ID
  async updateById(id: string, updateData: Partial<IResumenCajaDiario>): Promise<IResumenCajaDiario | null> {
    try {
      return await this.model.findByIdAndUpdate(id, updateData, { new: true }).exec();
    } catch (error) {
      throw new Error(`Error al actualizar ResumenCajaDiario: ${error.message}`);
    }
  }

  // Método para eliminar un resumen por ID
  async deleteById(id: string): Promise<IResumenCajaDiario | null> {
    try {
      return await this.model.findByIdAndDelete(id).exec();
    } catch (error) {
      throw new Error(`Error al eliminar ResumenCajaDiario: ${error.message}`);
    }
  }

  // Método para contar la cantidad de resúmenes según ciertos filtros
  async count(filters: FilterQuery<IResumenCajaDiario> = {}): Promise<number> {
    try {
      return await this.model.countDocuments(filters).exec();
    } catch (error) {
      throw new Error(`Error al contar resúmenes de caja: ${error.message}`);
    }
  }

  // Método para buscar resúmenes por rango de fechas
  async findByDateRange(startDate: Date, endDate: Date): Promise<IResumenCajaDiario[]> {
    try {
      return await this.model.find({
        fecha: { $gte: startDate, $lte: endDate }
      }).populate('sucursalId ventas.userId ventas.sucursalId').exec();
    } catch (error) {
      throw new Error(`Error al obtener resúmenes en rango de fechas: ${error.message}`);
    }
  }

  async findByDateAndBranch(branchId: Types.ObjectId, session: mongoose.mongo.ClientSession): Promise<IResumenCajaDiario> {
    try {
      let date = new Date;
      return await this.model.findOne({ fecha: date, sucursalId: branchId }, { session }) as IResumenCajaDiario;
    } catch (error) {
      throw new Error(`Error al obtener resúmenes en rango de fechas: ${error.message}`);
    }
  }

  // Método para obtener los resúmenes de una sucursal específica
  async findBySucursal(sucursalId: string, limit: number = 10, skip: number = 0): Promise<IResumenCajaDiario[]> {
    try {
      return await this.model.find({ sucursalId })
        .limit(limit)
        .skip(skip)
        .exec();
    } catch (error) {
      throw new Error(`Error al obtener resúmenes por sucursal: ${error.message}`);
    }
  }

  async addSaleDailySummary(data: IVentaCreateCaja, session: mongoose.mongo.ClientSession): Promise<IResumenCajaDiario | null> {
    try {
      const sucursalId = new Types.ObjectId(data.sucursalId);
      const totalIncrement = new Types.Decimal128(data.total!.toString());

      let existResumen = await this.findByDateAndBranch(sucursalId, session);

      if (!existResumen) {

        let dataResumen = {
          sucursalId,
          totalVentas: totalIncrement,
          montoFinalSistema: totalIncrement,
          fecha: new Date(),
          cajaId: new Types.ObjectId(data.cajaId),
          totalIngresos: new Types.Decimal128('0'),
          totalEgresos: new Types.Decimal128('0'),
          ventas: [ data ],
        }
        
        let resumenDiario = await this.create(dataResumen, session);

        return resumenDiario;
      }
  
      const resumenHoy = await this.model.findOneAndUpdate(
        { fecha: new Date(), sucursalId: new Types.ObjectId(sucursalId) },
        { $inc: { totalVentas: totalIncrement, montoFinalSistema: totalIncrement } },
        { new: true, upsert: true, session } 
      ).exec();
  
      if (!resumenHoy) {
        throw new Error('Error al actualizar o crear el resumen de caja diario para la sucursal');
      }

      resumenHoy.ventas.push(data);

      await resumenHoy.save({ session });
  
      return resumenHoy;
    } catch (error) {
      throw new Error(`Error al actualizar el ResumenCajaDiario: ${error.message}`);
    }
  }

  async addIncomeDailySummary( data:IAddIncomeDailySummary ): Promise<IResumenCajaDiario | null> {
    const { ingreso, session, sucursalId, cajaId } = data;

    try {
      const incomeIncrement = new Types.Decimal128(ingreso.toString());
      const sucursalIdMongo = new Types.ObjectId(sucursalId);
      const cajaIdMongo = new Types.ObjectId(cajaId);
  
      // Actualizar el resumen diario para incrementar totalIngresos y montoFinalSistema
      const resumenHoy = await this.model.findOneAndUpdate(
        { fecha: new Date(), sucursalId: sucursalIdMongo, cajaId: cajaIdMongo },
        { $inc: { totalIngresos: incomeIncrement, montoFinalSistema: incomeIncrement } },
        { new: true, upsert: true, session } ,
      ).exec();
  
      if (!resumenHoy) {
        throw new Error('Error al actualizar o crear el resumen de caja diario para la sucursal');
      }
  
      return resumenHoy;
    } catch (error) {
      throw new Error(`Error al actualizar el ResumenCajaDiario: ${error.message}`);
    }
  }
    
  async addExpenseDailySummary(data:IAddExpenseDailySummary): Promise<IResumenCajaDiario | null> {
    const { expense, session, sucursalId, cajaId } = data;
    const sucursalIdMongo = new Types.ObjectId(sucursalId);
    const expenseIncrement = new Types.Decimal128(expense.toString());
    const cajaIdMongo = new Types.ObjectId(cajaId);

    const resumenHoy = await this.model.findOneAndUpdate(
      { fecha: new Date(), sucursalId: sucursalIdMongo, cajaId: cajaIdMongo },
      { $inc: { totalEgresos: expenseIncrement, montoFinalSistema: -expenseIncrement } },
      { new: true, upsert: true, session } // Asegurarse de pasar la sesión
    ).exec();

    if (!resumenHoy) {
      throw new Error('Error al actualizar o crear el resumen de caja diario para la sucursal');
    }

    return resumenHoy;
  }
}