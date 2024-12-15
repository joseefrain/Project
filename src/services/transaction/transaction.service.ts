import { injectable, inject } from 'tsyringe';
import { TransactionRepository } from '../../repositories/transaction/transaction.repository';
import mongoose, { Types } from 'mongoose';
import { ITransaccion, ITransaccionCreate, ITransaccionDescuento, ITrasaccionProducto, TypeTransaction } from '../../models/transaction/Transaction.model';
import { ITipoDescuento } from '../../models/transaction/TransactionDescuentosAplicados.model';
import { IDetalleTransaccion } from '../../models/transaction/DetailTransaction.model';
import { IProducto } from '../../models/inventario/Producto.model';
import { IInventarioSucursal } from '../../models/inventario/InventarioSucursal.model';
import { IUser } from '../../models/usuarios/User.model';
import { CustomJwtPayload } from '../../utils/jwt';
import { ISucursal } from '../../models/sucursales/Sucursal.model';
import { InventoryManagementService } from '../traslado/InventoryManagement.service';
import { IAddQuantity, IInit, ISubtractQuantity, tipoMovimientoInventario } from '../../interface/IInventario';
import { IDescuento, ITipoDescuentoEntidad } from '../../models/transaction/Descuento.model';
import { notifyTelergramReorderThreshold } from '../utils/telegramServices';
import { DescuentoRepository } from '../../repositories/transaction/descuento.repository';
import { IDescuentosProductos } from '../../models/transaction/DescuentosProductos.model'; 
import { CashRegisterService } from '../utils/cashRegister.service';
import { ITransactionCreateCaja, TypeEstatusTransaction } from '../../interface/ICaja';
import { ICredito, ModalidadCredito } from '../../models/credito/Credito.model';
import { CreditoService } from '../credito/Credito.service';
import { ResumenCajaDiarioRepository } from 'src/repositories/caja/DailyCashSummary.repository';

export interface ICreateTransactionProps {
  venta: Partial<ITransaccionCreate>;
  user: CustomJwtPayload;
}

@injectable()
export class TransactionService {
  constructor(
    @inject(TransactionRepository) private repository: TransactionRepository,
    @inject(InventoryManagementService) private inventoryManagementService: InventoryManagementService,
    @inject(DescuentoRepository) private descuentoRepository: DescuentoRepository,
    @inject(CashRegisterService) private cashRegisterService: CashRegisterService,
    @inject(CreditoService) private creditoService: CreditoService,
    @inject(ResumenCajaDiarioRepository) private resumenRepository: ResumenCajaDiarioRepository
  ) {}

  async addTransactionToQueue(data: ICreateTransactionProps) {
    const result = await this.createTransaction(data)
    return result;
  }

  async createTransaction(data: ICreateTransactionProps): Promise<Partial<ITransaccionCreate>> {
    const { venta, user } = data;
    // venta.tipoTransaccion = "VENTA";
    try {
      let listInventarioSucursalIds = venta.products?.map((detalle) =>detalle.inventarioSucursalId) as string[];

      let dataInit:IInit = {
        userId: user._id,
        branchId: venta.sucursalId!,
        listInventarioSucursalId: listInventarioSucursalIds
      }

      await this.inventoryManagementService.init(dataInit);

      let sucursalId = new mongoose.Types.ObjectId(venta.sucursalId!);
      let usuarioId = new mongoose.Types.ObjectId(venta.userId!);

      let listInventarioSucursal:IInventarioSucursal[] = []

      let newVenta = {
        usuarioId: usuarioId,
        sucursalId: sucursalId,
        subtotal: new mongoose.Types.Decimal128(venta.subtotal?.toString()!),
        total: new mongoose.Types.Decimal128(venta.total?.toString()!),
        descuento: new mongoose.Types.Decimal128(venta.discount?.toString()! || "0"),
        deleted_at: null,
        fechaRegistro: new Date(),
        tipoTransaccion: data.venta.tipoTransaccion,
        paymentMethod: venta.paymentMethod,
        entidadId : new mongoose.Types.ObjectId(venta.entidadId!),
        estadoTrasaccion: (venta.paymentMethod === 'credit' ? 'PENDIENTE' : 'PAGADA') as TypeEstatusTransaction
      }

      const newSale = await this.repository.create(newVenta);

      for await (const element of venta.products!) {

        let subtotal = element.price * element.quantity;
        let descuentoMonto = element.discount?.amount! || 0;
        let total = subtotal - descuentoMonto;
        let productoId = new mongoose.Types.ObjectId(element.productId);
        let tipoAplicacion:ITipoDescuentoEntidad = element.discount?.type === "grupo" ? 'Group' : 'Product';

        let detalleVenta = {
          ventaId: (newSale._id as mongoose.Types.ObjectId),
          productoId: productoId,
          precio: new mongoose.Types.Decimal128(element.price?.toString()!),
          cantidad: element.quantity,
          subtotal: new mongoose.Types.Decimal128(subtotal.toString()),
          total: new mongoose.Types.Decimal128(total.toString()),
          descuento: new mongoose.Types.Decimal128(descuentoMonto.toString()),
          deleted_at: null,
          tipoCliente: element.clientType,
          tipoDescuentoEntidad: tipoAplicacion,
        }

        let newdDetalleVenta = await this.repository.createDetalleVenta(detalleVenta);

        (newSale.transactionDetails as mongoose.Types.ObjectId[]).push(newdDetalleVenta._id as mongoose.Types.ObjectId);
        
        let descuentoElement = element.discount;

        if(descuentoElement) {
          let descuentosProductosId: mongoose.Types.ObjectId | undefined;
          let descuentoGrupoId: mongoose.Types.ObjectId | undefined;

          if (tipoAplicacion === 'Product') {
            descuentoGrupoId = undefined;

            let descuentoProducto = await this.descuentoRepository.getDescuentoProductoByDescuentoId(descuentoElement.id);

            if(descuentoProducto) {
              descuentosProductosId = (descuentoProducto._id as mongoose.Types.ObjectId);
            } else {
              descuentosProductosId = undefined;
            }
          } else if (tipoAplicacion === 'Group') {
            descuentosProductosId = undefined;

            let descuentoGrupo = await this.descuentoRepository.getDescuentoGrupoByDescuentoId(descuentoElement.id);

            if(descuentoGrupo) {
              descuentoGrupoId = (descuentoGrupo.descuentoId as mongoose.Types.ObjectId);
            } else {
              descuentoGrupoId = undefined;
            }
          }

          let tipo:ITipoDescuento = "PORCENTAJE";
          let valor = element.discount?.amount! / element.quantity;

          let ventaDescuentosAplicados = {
            detalleVentaId: (newdDetalleVenta._id as mongoose.Types.ObjectId),
            descuentosProductosId: descuentosProductosId,
            descuentoGrupoId: descuentoGrupoId,
            tipoAplicacion: tipoAplicacion,
            valor: new mongoose.Types.Decimal128(valor.toString()!),
            tipo: tipo,
            monto: new mongoose.Types.Decimal128(descuentoMonto.toString()!),
          }
  
          await this.repository.createVentaDescuentosAplicados(ventaDescuentosAplicados);
        }

        if (newSale.tipoTransaccion === 'VENTA') {

          let dataSubTractQuantity:ISubtractQuantity = {
            inventarioSucursalId: new mongoose.mongo.ObjectId(element.inventarioSucursalId),
            quantity: element.quantity,
            
            isNoSave:true,
            tipoMovimiento: data.venta.tipoTransaccion === 'VENTA' ? tipoMovimientoInventario.VENTA : tipoMovimientoInventario.COMPRA
          }
          
         let inventarioSucursal = (await this.inventoryManagementService.subtractQuantity(dataSubTractQuantity) as IInventarioSucursal)
  
         if (inventarioSucursal.stock <= inventarioSucursal.puntoReCompra) {
            listInventarioSucursal.push(inventarioSucursal);
          }
          
        } else if (newSale.tipoTransaccion === 'COMPRA') {
          let dataAddQuantity:IAddQuantity = {
            quantity: element.quantity,
            inventarioSucursalId: new mongoose.mongo.ObjectId(element.inventarioSucursalId) ,
            isNoSave:true,
            tipoMovimiento: data.venta.tipoTransaccion === 'VENTA' ? tipoMovimientoInventario.VENTA : tipoMovimientoInventario.COMPRA
          };
  
          await this.inventoryManagementService.addQuantity(dataAddQuantity)
        }
      }
 
      await this.inventoryManagementService.updateAllBranchInventory();
      await this.inventoryManagementService.saveAllMovimientoInventario();

      let ventaActualizar = ({...data.venta, id: (newSale._id as Types.ObjectId).toString(), } as ITransactionCreateCaja);
      
      const datosActualizar = {
        data: ventaActualizar,   
      }

      await newSale.save();

      if (data.venta.paymentMethod === 'cash') {
        await this.cashRegisterService.actualizarMontoEsperadoByTrasaccion(datosActualizar!); 
      }

      await this.resumenRepository.addTransactionDailySummary(datosActualizar.data);

      if (newSale.paymentMethod === 'credit') {
        let credito:Partial<ICredito> = {
          sucursalId: newSale.sucursalId,
          entidadId: newSale.entidadId as mongoose.Types.ObjectId,
          transaccionId: newSale._id as mongoose.Types.ObjectId,
          tipoCredito: newSale.tipoTransaccion as 'VENTA' | 'COMPRA',
          modalidadCredito: venta.credito?.modalidadCredito as ModalidadCredito,
          saldoCredito: new mongoose.Types.Decimal128(`${venta.total}`),
          plazoCredito: venta.credito?.plazoCredito as number,
          cuotaMensual: venta.credito?.cuotaMensual as mongoose.Types.Decimal128,
          pagoMinimoMensual: venta.credito?.pagoMinimoMensual as mongoose.Types.Decimal128,
          fechaVencimiento: new Date()
        }

        await this.creditoService.createCredito(credito);
      }

      let productListReOrder = listInventarioSucursal
        .filter((item) => item.stock < item.puntoReCompra)
        .map((item) => ({
          name: (item.productoId as IProducto).nombre,
          currentQuantity: item.stock,
          reorderPoint: item.puntoReCompra,
        }));

      // productListReOrder.length > 0 &&
      //   notifyTelergramReorderThreshold(
      //     user.username,
      //     (listInventarioSucursal[0].sucursalId as ISucursal).nombre,
      //     productListReOrder,
      //     user.chatId
      //   );
      
      

      return venta;
    } catch (error) {
      console.log(error);

      
      

      throw new Error(error.message);
    }
  }
  async findByTypeAndBranch(sucursalId: string, type: TypeTransaction): Promise<ITransaccionCreate[]> {
    // Obtener todas las ventas de la sucursal especificada
    const transaccion = await this.repository.findByTypeAndBranch(sucursalId, type);
    let transactionDto: ITransaccionCreate[] = await this.mapperDataAll(transaccion);
  
    return transactionDto;
  }

  async findAllVentaBySucursalIdAndUserId(sucursalId: string, userId: string): Promise<ITransaccionCreate[]> {
    const ventas = await this.repository.findAllVentaBySucursalIdAndUserId(sucursalId, userId);

    let ventasDto: ITransaccionCreate[] = [];
  
    // Iterar sobre cada venta y obtener los detalles de venta
    for (const venta of ventas) {
      const detalleVenta = await this.repository.findAllDetalleVentaByVentaId((venta._id as Types.ObjectId).toString());
      const ventaDto = (await this.mapperData(venta, detalleVenta) as ITransaccionCreate);
      ventasDto.push(ventaDto);
    }
  
    return ventasDto;
  }

  async getAllVentasBySucursalIdAndUserId(sucursalId: string, userId: string): Promise<ITransaccion[]> {
    return this.repository.findAllVentaBySucursalIdAndUserId(sucursalId, userId);
  }

  async getTransactionById(id: string): Promise<ITransaccionCreate | null> {
    let venta = (await this.repository.findTransaccionById(id) as ITransaccion);

    let detalleVenta = await this.repository.findAllDetalleVentaByVentaId(id);

    let ventaDto:ITransaccionCreate = (await this.mapperData(venta, detalleVenta) as ITransaccionCreate);

    return ventaDto;
  }

 async mapperData(venta: ITransaccion, detalleVenta: IDetalleTransaccion[]): Promise<ITransaccionCreate> {
    let products: ITrasaccionProducto[] = [];

    for await (const detalle of detalleVenta) {
      let descuento:ITransaccionDescuento | null = null;

      if (detalle.descuento.toString() !== "0") {
        
        let descuentoAplicado = await this.repository.findVentaDescuentosAplicadosByDetalleVentaId((detalle._id as mongoose.Types.ObjectId).toString());

        if (descuentoAplicado) {
          let tipoAplicacion = descuentoAplicado.tipoAplicacion;
          let descuentoTipo = descuentoAplicado.descuentosProductosId ? descuentoAplicado.descuentosProductosId : descuentoAplicado.descuentoGrupoId;
          let descuentoId = ((descuentoTipo as IDescuentosProductos).descuentoId as IDescuento);
          
          descuento = {
            id: (descuentoId._id as mongoose.Types.ObjectId).toString(),
            name: descuentoId.nombre,
            amount: Number(descuentoAplicado.valor),
            percentage: descuentoId.valorDescuento,
            type: tipoAplicacion === "Product" ? "producto" : "grupo",
          }
        }
      }

      let producto = {
        productId: ((detalle.productoId as IProducto)._id as mongoose.Types.ObjectId).toString(),
        clientType: detalle.tipoCliente,
        productName: (detalle.productoId as IProducto).nombre,
        quantity: detalle.cantidad,
        price: Number(detalle.precio),
        ventaId: (venta._id as mongoose.Types.ObjectId).toString(),
        inventarioSucursalId: "",
        groupId: "",
        discount: descuento
      }
   
      products.push(producto);
    }

    let ventaDto: ITransaccionCreate = {
      userId: (venta.usuarioId as IUser).username,
      sucursalId: venta.sucursalId.toString(),
      subtotal: Number(venta.subtotal),
      total: Number(venta.total),
      discount: Number(venta.descuento),
      fechaRegistro: venta.fechaRegistro,
      products: products,
      paymentMethod: venta.paymentMethod,
      tipoTransaccion: venta.tipoTransaccion
    }

    return ventaDto;
  }

  async mapperDataAll(ventas: ITransaccion[]): Promise<ITransaccionCreate[]> {

    const results = await Promise.all(
      ventas.map(venta => this.mapperData(venta, venta.transactionDetails as IDetalleTransaccion[]))
    );
  
    return results;
  }

  async getAllDetalleVentaByVentaId(ventaId: string): Promise<IDetalleTransaccion[]> {
    return this.repository.findAllDetalleVentaByVentaId(ventaId);
  }
}
