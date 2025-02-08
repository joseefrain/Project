import { injectable, inject } from 'tsyringe';
import { TransactionRepository } from '../../repositories/transaction/transaction.repository';
import mongoose, { Types } from 'mongoose';
import {
  IDevolucionesCreate,
  ITransaccion,
  ITransaccionCreate,
  ITransaccionNoDto,
  ITransaccionResponse,
  TypeTransaction,
} from '../../models/transaction/Transaction.model';
import { ITransaccionDescuentosAplicados } from '../../models/transaction/TransactionDescuentosAplicados.model';
import { IDetalleTransaccion } from '../../models/transaction/DetailTransaction.model';
import { CustomJwtPayload } from '../../utils/jwt';
import { IDescuento } from '../../models/transaction/Descuento.model';
import { IDescuentosProductos } from '../../models/transaction/DescuentosProductos.model';
import { ResumenCajaDiarioRepository } from '../../repositories/caja/DailyCashSummary.repository';
import { cero128, formatObejectId } from '../../gen/handleDecimal128';
import { IResumenCajaDiario } from '../../models/cashRegister/DailyCashSummary.model';
import { HelperCreateTransaction } from './helpers/helperCreateTransaction';
import { HelperCreateReturned } from './helpers/helperCreateReturned';
import { HelperMapperTransaction } from './helpers/helperMapper';
import { TypeEstatusTransaction } from '../../interface/ICaja';
import { CashRegisterService } from '../utils/cashRegister.service';

export interface ICreateTransactionProps {
  venta: Partial<ITransaccionCreate>;
  user: CustomJwtPayload;
}

@injectable()
export class TransactionService {
  constructor(
    @inject(TransactionRepository) private repository: TransactionRepository,
    @inject(ResumenCajaDiarioRepository) private resumenRepository: ResumenCajaDiarioRepository,
    @inject(HelperCreateTransaction) private helperCreateTransaction: HelperCreateTransaction,
    @inject(HelperCreateReturned) private helperCreateReturned: HelperCreateReturned,
    @inject(HelperMapperTransaction) private helperMapperTransaction: HelperMapperTransaction,
    @inject(CashRegisterService) private cashRegisterService: CashRegisterService
  ) {}

  async addTransactionToQueue(data: ICreateTransactionProps) {
    const result = await this.createTransaction(data);
    return result;
  }

  async createTransaction(data: ICreateTransactionProps): Promise<Partial<ITransaccionCreate>> {
    const { venta, user } = data;

    try {

      let verifyExistResumenCajaDiario = await this.cashRegisterService.verifyExistResumenCajaDiario(venta.cajaId!);

      if (!verifyExistResumenCajaDiario) {
        await this.cashRegisterService.cierreAutomatico(venta.cajaId!);
        throw new Error("Cierre de caja automatico. No se puede crear transaccion");
      }
      // 1️⃣ Inicializar Inventario
      await this.helperCreateTransaction.initInventory(venta, user._id);

      // 2️⃣ Crear la venta
      const newSale = await this.helperCreateTransaction.createSale(venta);

      // 3️⃣ Manejar detalles de venta y descuentos
      await this.helperCreateTransaction.handleTransactionDetails(newSale, venta);

      // 4️⃣ Manejar inventario
      await this.helperCreateTransaction.handleInventory(newSale, venta, user);

      // 5️⃣ Actualizar caja, resumen y manejar crédito si aplica
      await this.helperCreateTransaction.updateCashRegisterAndSummary(newSale, venta);

      return { ...venta, id: formatObejectId(newSale._id).toString() };
    } catch (error) {
      console.error(error);
      throw new Error(error.message);
    }
  }

  async findByTypeAndBranch(sucursalId: string, type: TypeTransaction): Promise<ITransaccionResponse[]> {
    // Obtener todas las ventas de la sucursal especificada
    const transaccion = await this.repository.findByTypeAndBranch(sucursalId, type);
    let transactionDto: ITransaccionResponse[] = await this.helperMapperTransaction.mapperDataAll(transaccion);

    return transactionDto;
  }

  async findDevolucionesBySucursalId(
    sucursalId: string,
    typeTransaction: TypeTransaction
  ): Promise<ITransaccionCreate[]> {
    const ventas = await this.repository.findByTypeAndBranchDevolucion(sucursalId, typeTransaction);

    let ventasDto: ITransaccionCreate[] = [];

    // Iterar sobre cada venta y obtener los detalles de venta
    for (const venta of ventas) {
      const ventaDto = (await this.helperMapperTransaction.mapperDataReturn(
        venta,
        venta.transactionDetails as IDetalleTransaccion[]
      )) as ITransaccionCreate;
      ventasDto.push(ventaDto);
    }

    return ventasDto;
  }

  async findAllVentaBySucursalIdAndUserId(sucursalId: string, userId: string): Promise<ITransaccionCreate[]> {
    const ventas = await this.repository.findAllVentaBySucursalIdAndUserId(sucursalId, userId);

    let ventasDto: ITransaccionCreate[] = [];

    // Iterar sobre cada venta y obtener los detalles de venta
    for (const venta of ventas) {
      const detalleVenta = await this.repository.findAllDetalleVentaByVentaId((venta._id as Types.ObjectId).toString());
      const ventaDto = (await this.helperMapperTransaction.mapperData(venta, detalleVenta)) as ITransaccionCreate;
      ventasDto.push(ventaDto);
    }

    return ventasDto;
  }

  async getAllVentasBySucursalIdAndUserId(sucursalId: string, userId: string): Promise<ITransaccion[]> {
    return this.repository.findAllVentaBySucursalIdAndUserId(sucursalId, userId);
  }

  async getTransactionById(id: string): Promise<ITransaccionCreate | null> {
    let venta = (await this.repository.findTransaccionById(id)) as ITransaccion;

    let ventaDto: ITransaccionCreate = (await this.helperMapperTransaction.mapperData(
      venta,
      venta.transactionDetails as IDetalleTransaccion[]
    )) as ITransaccionCreate;

    return ventaDto;
  }

  async getTransactionByIdNoDto(id: string): Promise<ITransaccionNoDto | null> {
    let venta = (await this.repository.findTransaccionById(id)) as ITransaccion;

    return {
      transaccion: venta,
      datalleTransaccion: venta.transactionDetails as IDetalleTransaccion[],
    };
  }

  async getAllDetalleVentaByVentaId(ventaId: string): Promise<IDetalleTransaccion[]> {
    return this.repository.findAllDetalleVentaByVentaId(ventaId);
  }

  async findDescuentoByDescuentoAplicado(descuentoAplicado: ITransaccionDescuentosAplicados): Promise<IDescuento> {
    let descuentoTipo = descuentoAplicado.descuentosProductosId
      ? descuentoAplicado.descuentosProductosId
      : descuentoAplicado.descuentoGrupoId;
    let descuentoId = (descuentoTipo as IDescuentosProductos).descuentoId as IDescuento;
    return descuentoId;
  }

  async getResumenDiarioByCashierId(id: string): Promise<IResumenCajaDiario | null> {
    let cashier = new mongoose.Types.ObjectId(id);
    const resumenDiario = await this.resumenRepository.findByDateAndCashier(cashier);
    return resumenDiario;
  }

  async createDevolucion(data: IDevolucionesCreate) {
    const transaccion = await this.helperCreateReturned.validateTransactionExists(data.trasaccionOrigenId);
    const { sucursalId, usuarioId, cajaId } = this.helperCreateReturned.getTransactionMetadata(transaccion, data);
    const descuentosAplicados = await this.helperCreateReturned.getAppliedDiscounts(transaccion);
    let isSaleTransaction = transaccion.tipoTransaccion === TypeTransaction.VENTA;
    let tipoTransaccionDevolucion = isSaleTransaction ? TypeTransaction.COMPRA : TypeTransaction.VENTA;

    // creamos el nuevo retorno
    const newReturn = await this.helperCreateReturned.createReturnTransaction(
      transaccion,
      usuarioId,
      sucursalId,
      cajaId,
      cero128,
      cero128
    );

    // procesamos los productos
    const {
      totalDevolucion128,
      totalAjusteACobrar,
      newTotalTransaccionOrigen,
      subTotalTransaccionOrigen,
      listDetailTransaction,
      newTotalDiscountApplied
    } = await this.helperCreateReturned.processReturnProducts(
      data,
      transaccion,
      descuentosAplicados,
      sucursalId,
      newReturn
    );

    // actualizamos el retorno
    await this.helperCreateReturned.updateReturnTransaction(newReturn, totalDevolucion128, totalAjusteACobrar);

    // actualizamos el original
    await this.helperCreateReturned.updateOriginalTransaction(
      transaccion,
      newTotalTransaccionOrigen,
      subTotalTransaccionOrigen,
      data,
      newTotalDiscountApplied
    );

    // finalizamos las operaciones de inventario
    await this.helperCreateReturned.finalizeInventoryOperations();

    // manejamos el pago
    const { caja, ventaActualizar } = await this.helperCreateReturned.handlePaymentOperations(
      transaccion,
      data,
      newReturn,
      totalDevolucion128,
      tipoTransaccionDevolucion
    );

    // obtenemos los resultados finales
    const results = await this.helperCreateReturned.getFinalResults(newReturn, transaccion, listDetailTransaction);

    return { ...results, caja };
  }

  async findTransactionsByProductId(
    productId: string,
    estadoTrasaccion: TypeEstatusTransaction
  ): Promise<Partial<ITransaccion>[]> {
    return this.repository.findTransactionsByProductId(productId, estadoTrasaccion);
  }
}
