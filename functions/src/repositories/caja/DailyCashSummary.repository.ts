import mongoose, { Model, FilterQuery, Types, mongo } from 'mongoose';
import ResumenCajaDiario, { IResumenCajaDiario } from '../../models/cashRegister/DailyCashSummary.model';
import { IAddExpenseDailySummary, IAddIncomeDailySummary } from '../../interface/ICaja';
import { ITransaccion } from '../../models/transaction/Transaction.model';

export class ResumenCajaDiarioRepository {
  private model: Model<IResumenCajaDiario>;

  constructor() {
    this.model = ResumenCajaDiario;
  }

  // Método para crear un nuevo resumen de caja diario
  async create(data: Partial<IResumenCajaDiario>): Promise<IResumenCajaDiario> {
    try {
      const resumen = new this.model(data);
      return await resumen.save();
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

  async findByDateAndCashier(cashierId: Types.ObjectId): Promise<IResumenCajaDiario | null> {
    try {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      return await this.model.findOne(
        { fecha: date, cajaId: cashierId },
        {} // Objeto de proyección (puede estar vacío si necesitas todos los campos)
      ) as IResumenCajaDiario;
    } catch (error) {
      throw new Error(`Error al obtener resúmenes en rango de fechas: ${error.message}`);
    }
  }

  async findTodayResumenByCashier(cashierId: Types.ObjectId): Promise<IResumenCajaDiario | null> {
    try {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      return await this.model.findOne({ cajaId: cashierId, fecha: date }).populate([
        {
          path: 'ventas',
          populate: {
            path: 'transactionDetails',
          },
        },
        {
          path: 'compras',
          populate: {
            path: 'transactionDetails',
          },
        }
      ])
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

  async addTransactionDailySummary(transaccion: ITransaccion, sucursalId: Types.ObjectId): Promise<IResumenCajaDiario | null> {
    try {
      const tipoTransaccion = transaccion.tipoTransaccion;
      const totalIncrement = transaccion.total;
      const cashierId = transaccion.cajaId as Types.ObjectId;

      let existResumen = await this.findByDateAndCashier(cashierId);

      const fecha = new Date();
      fecha.setHours(0, 0, 0, 0);

      if (!existResumen) {
        let dataResumen = {
          sucursalId,
          totalVentas: tipoTransaccion === 'VENTA' ? totalIncrement : new Types.Decimal128('0'),
          totalCompras: tipoTransaccion === 'COMPRA' ? totalIncrement : new Types.Decimal128('0'),
          montoFinalSistema: totalIncrement,
          fecha: fecha,
          cajaId: cashierId,
          totalIngresos: new Types.Decimal128('0'),
          totalEgresos: new Types.Decimal128('0'),
          ventas: [ transaccion._id as Types.ObjectId ],
        }

        let resumenDiario = await this.create(dataResumen);

        return resumenDiario;
      }
      
      let totalSale = tipoTransaccion === 'VENTA' ? +Number(totalIncrement) : +Number(0);
      let totalPurchase = tipoTransaccion === 'COMPRA' ? +Number(totalIncrement) : +Number(0);
      let montoFinalSistema = tipoTransaccion === 'VENTA' ? +Number(totalIncrement) : -Number(totalIncrement);
  
      const resumenHoy = await this.model.findOneAndUpdate(
        { fecha: fecha, sucursalId },
        { $inc: { totalVentas: totalSale, totalCompras: totalPurchase, montoFinalSistema: montoFinalSistema } },
        { new: true, upsert: true } 
      ).exec();
  
      if (!resumenHoy) {
        throw new Error('Error al actualizar o crear el resumen de caja diario para la sucursal');
      }

      if (tipoTransaccion === 'VENTA') {
        (resumenHoy.ventas as Types.ObjectId[]).push(transaccion._id as Types.ObjectId);
      } else if (tipoTransaccion === 'COMPRA') {
        (resumenHoy.compras as Types.ObjectId[]).push(transaccion._id as Types.ObjectId);
      }

      await resumenHoy.save();
  
      return resumenHoy;
    } catch (error) {
      throw new Error(`Error al actualizar el ResumenCajaDiario: ${error.message}`);
    }
  }

  async addIncomeDailySummary( data:IAddIncomeDailySummary ): Promise<IResumenCajaDiario | null> {
    const { ingreso, sucursalId, cajaId } = data;

    try {
      const incomeIncrement = new Types.Decimal128(ingreso.toString());
      const sucursalIdMongo = new Types.ObjectId(sucursalId);
      const cajaIdMongo = new Types.ObjectId(cajaId);
  
      // Actualizar el resumen diario para incrementar totalIngresos y montoFinalSistema
      const resumenHoy = await this.model.findOneAndUpdate(
        { fecha: new Date(), sucursalId: sucursalIdMongo, cajaId: cajaIdMongo },
        { $inc: { totalIngresos: incomeIncrement, montoFinalSistema: incomeIncrement } },
        { new: true, upsert: true } ,
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
    const { expense, sucursalId, cajaId } = data;
    const sucursalIdMongo = new Types.ObjectId(sucursalId);
    const expenseIncrement = new Types.Decimal128(expense.toString());
    const cajaIdMongo = new Types.ObjectId(cajaId);

    const resumenHoy = await this.model.findOneAndUpdate(
      { fecha: new Date(), sucursalId: sucursalIdMongo, cajaId: cajaIdMongo },
      { $inc: { totalEgresos: expenseIncrement, montoFinalSistema: -expenseIncrement } },
      { new: true, upsert: true } // Asegurarse de pasar la sesión
    ).exec();

    if (!resumenHoy) {
      throw new Error('Error al actualizar o crear el resumen de caja diario para la sucursal');
    }

    return resumenHoy;
  }
}