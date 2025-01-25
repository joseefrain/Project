import { injectable, inject } from 'tsyringe';
import { TransactionRepository } from '../../repositories/transaction/transaction.repository';
import mongoose, { Types } from 'mongoose';
import { IDevolucionesCreate, ITransaccion, ITransaccionCreate, ITransaccionDescuento, ITransaccionNoDto, ITrasaccionProducto, TypeTransaction } from '../../models/transaction/Transaction.model';
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
import { ITransactionCreateCaja, tipoEstatusSales, TypeEstatusTransaction } from '../../interface/ICaja';
import { ICredito, ModalidadCredito } from '../../models/credito/Credito.model';
import { CreditoService } from '../credito/Credito.service';
import { ResumenCajaDiarioRepository } from '../../repositories/caja/DailyCashSummary.repository';
import { CreditoRepository } from '../../repositories/credito/Credito.repository';
import { restarDecimal128 } from '../../gen/handleDecimal128';

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
    @inject(ResumenCajaDiarioRepository) private resumenRepository: ResumenCajaDiarioRepository,
    @inject(CreditoService) private service: CreditoService,
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
      let cajaId = new mongoose.Types.ObjectId(venta.cajaId!);

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
        estadoTrasaccion: (venta.paymentMethod === 'credit' ? 'PENDIENTE' : 'PAGADA') as TypeEstatusTransaction,
        cajaId: cajaId
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
            tipoMovimiento: data.venta.tipoTransaccion === 'VENTA' ? tipoMovimientoInventario.VENTA : tipoMovimientoInventario.COMPRA,
            cost: element.costoUnitario
          };
  
          await this.inventoryManagementService.addQuantity(dataAddQuantity)
        }
      }
 
      await this.inventoryManagementService.updateAllBranchInventory();
      await this.inventoryManagementService.saveAllMovimientoInventario();

      let ventaActualizar = ({...data.venta, id: (newSale._id as Types.ObjectId), } as ITransactionCreateCaja);
      const datosActualizar = {
        data: ventaActualizar,   
      }

      await newSale.save();

      if (data.venta.paymentMethod === 'cash') {
        await this.cashRegisterService.actualizarMontoEsperadoByTrasaccion(datosActualizar!); 
      }

      await this.resumenRepository.addTransactionDailySummary(newSale, sucursalId);

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

  async getTransactionByIdNoDto(id: string): Promise<ITransaccionNoDto | null> {
    let venta = (await this.repository.findTransaccionById(id) as ITransaccion);

    let detalleVenta = await this.repository.findAllDetalleVentaByVentaId(id);


    return {transaccion: venta, datalleTransaccion: detalleVenta};
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
        discount: descuento,
        costoUnitario: 0
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

  async createDevolucion(data: IDevolucionesCreate) {

    let transaccion = await this.getTransactionByIdNoDto(data.trasaccionOrigenId);

    if (!transaccion?.transaccion) {
      throw new Error('Transaccion no encontrada');
    }

    let productIdsByBranch = data.products?.map((detalle) => detalle.productId) as string[];

      let dataInit:IInit = {
        userId: data.userId,
        branchId: data.sucursalId!,
        listInventarioSucursalId: [],
        listProductId: productIdsByBranch,
        searchWithProductId: true
      }

      let listInventarioSucursal = await this.inventoryManagementService.init(dataInit);

      let sucursalId = new mongoose.Types.ObjectId(data.sucursalId!);
      let usuarioId = new mongoose.Types.ObjectId(data.userId!);
      let cajaId = new mongoose.Types.ObjectId(data.cajaId!);

      let getDetalleVenta = (productId:string) => {
        let productoIdObj = new mongoose.Types.ObjectId(productId);
        let detalleVenta = transaccion.datalleTransaccion.find((item) => (item.productoId as IProducto)._id === productoIdObj);

        return detalleVenta
      }

      let getProductoPrice = (productId:string) => {
        let detalleVenta = getDetalleVenta(productId)
        let price = parseFloat((detalleVenta?.total as mongoose.Types.Decimal128).toString()) / (detalleVenta?.cantidad as number);

        return price
      }

      let totalDevolucion = data.products?.reduce((acc, item) => acc + getProductoPrice(item.productId) * item.quantity, 0) as number;

      let totalTransaccion = restarDecimal128(transaccion.transaccion.total, new mongoose.Types.Decimal128(totalDevolucion.toString()))

      let newVenta = {
        usuarioId: usuarioId,
        sucursalId: sucursalId,
        subtotal: new mongoose.Types.Decimal128(totalDevolucion.toString()),
        total: new mongoose.Types.Decimal128(totalDevolucion?.toString()!),
        descuento: new mongoose.Types.Decimal128("0"),
        deleted_at: null,
        fechaRegistro: new Date(),
        tipoTransaccion: ('DEVOLUCION' as TypeTransaction),
        paymentMethod: transaccion.transaccion.paymentMethod,
        entidadId : (transaccion?.transaccion as ITransaccion).entidadId,
        estadoTrasaccion: tipoEstatusSales.DEVOLUCION,
        cajaId: cajaId,
        transaccionOrigenId: transaccion.transaccion._id as mongoose.Types.ObjectId,
      }

      const newReturn = await this.repository.create(newVenta);

      for await (const element of data.products!) {
        let productoId = new mongoose.Types.ObjectId(element.productId);
        let inventarioSucursal = listInventarioSucursal.find((item) => (item.productoId as IProducto)._id === productoId);
        let inventarioSucursalId = ((inventarioSucursal as IInventarioSucursal)._id as Types.ObjectId)
        let subtotal = element.price * element.quantity;
        let descuentoMonto = 0;
        let total = subtotal - descuentoMonto;
        let tipoAplicacion:ITipoDescuentoEntidad = 'Product';

        let detalleVenta = {
          ventaId: (newReturn._id as mongoose.Types.ObjectId),
          productoId: productoId,
          precio: new mongoose.Types.Decimal128(element.price?.toString()!),
          cantidad: element.quantity,
          subtotal: new mongoose.Types.Decimal128(subtotal.toString()),
          total: new mongoose.Types.Decimal128(total.toString()),
          descuento: new mongoose.Types.Decimal128(descuentoMonto.toString()),
          deleted_at: null,
          tipoCliente: 'Regular' as 'Regular',
          tipoDescuentoEntidad: tipoAplicacion,
        }

        let newdDetailReturn = await this.repository.createDetalleVenta(detalleVenta);

        if (transaccion.transaccion.tipoTransaccion === 'COMPRA') {

          let dataSubTractQuantity:ISubtractQuantity = {
            inventarioSucursalId: inventarioSucursalId,
            quantity: element.quantity,
            isNoSave:true,
            tipoMovimiento:  tipoMovimientoInventario.DEVOLUCION
          }
          
         let inventarioSucursal = (await this.inventoryManagementService.subtractQuantity(dataSubTractQuantity) as IInventarioSucursal)
  
         if (inventarioSucursal.stock <= inventarioSucursal.puntoReCompra) {
            listInventarioSucursal.push(inventarioSucursal);
          }
          
        } else if (transaccion.transaccion.tipoTransaccion === 'VENTA') {
          let dataAddQuantity:IAddQuantity = {
            quantity: element.quantity,
            inventarioSucursalId: inventarioSucursalId,
            isNoSave:true,
            tipoMovimiento:  tipoMovimientoInventario.DEVOLUCION,
          };
  
          await this.inventoryManagementService.addQuantity(dataAddQuantity)
        }

        (newReturn.transactionDetails as mongoose.Types.ObjectId[]).push(newdDetailReturn._id as mongoose.Types.ObjectId);

        let detalleTransaccionOrigen = getDetalleVenta(element.productId);

        if (!data.esTodaLaVenta) {
          if (detalleTransaccionOrigen) {
            if (detalleTransaccionOrigen.cantidad === element.quantity) {
              detalleTransaccionOrigen.deleted_at = new Date();
              await detalleTransaccionOrigen.save();
              
            } else {
              
              detalleTransaccionOrigen.cantidad = detalleTransaccionOrigen.cantidad - element.quantity;
              await detalleTransaccionOrigen.save();
            }
          }
        }
      }

      if (data.esTodaLaVenta) {
        transaccion.transaccion.deleted_at = new Date();
        await transaccion.transaccion.save();
      } else {
        let subTotal = `${data.products?.reduce((acc, item) => acc + item.price * item.quantity, 0)}`
        transaccion.transaccion.subtotal = new mongoose.Types.Decimal128(subTotal);
        transaccion.transaccion.total = totalTransaccion
        await transaccion.transaccion.save();
      }

      await this.inventoryManagementService.updateAllBranchInventory();
      await this.inventoryManagementService.saveAllMovimientoInventario();

      let ventaActualizar = {
        id: newReturn._id as Types.ObjectId,
        tipoTransaccion: transaccion.transaccion.tipoTransaccion,
        cajaId: (newReturn.cajaId as Types.ObjectId).toString(),
        userId: data.userId,
        total: totalDevolucion,
        subtotal: totalDevolucion,
        monto: data.monto,
      } as ITransactionCreateCaja;

      const datosActualizar = {
        data: ventaActualizar,   
      }

      if (transaccion.transaccion.paymentMethod === 'credit') {
        const dineroADevolver = await this.creditoService.returnTransactionById(data.trasaccionOrigenId, totalDevolucion);

        ventaActualizar.total = dineroADevolver;
        ventaActualizar.monto = dineroADevolver;

        await this.cashRegisterService.actualizarMontoEsperadoByTrasaccion(datosActualizar!); 
      }

      await newReturn.save();
      
      if (transaccion.transaccion.paymentMethod === 'cash') {
        await this.cashRegisterService.actualizarMontoEsperadoByTrasaccion(datosActualizar!); 
      }

      await this.resumenRepository.addTransactionDailySummary(newReturn, sucursalId);
  }
}
