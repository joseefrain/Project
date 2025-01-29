import { injectable, inject } from 'tsyringe';
import { TransactionRepository } from '../../repositories/transaction/transaction.repository';
import mongoose, { Types } from 'mongoose';
import { IDescuentoAplicado, IDevolucionesCreate, ITransaccion, ITransaccionCreate, ITransaccionDescuento, ITransaccionNoDto, ITransaccionResponse, ITrasaccionProducto, ITrasaccionProductoResponse, TypeTransaction } from '../../models/transaction/Transaction.model';
import { ITipoDescuento, ITransaccionDescuentosAplicados } from '../../models/transaction/TransactionDescuentosAplicados.model';
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
import { cero128, dividirDecimal128, formatObejectId, multiplicarDecimal128, restarDecimal128, sumarDecimal128 } from '../../gen/handleDecimal128';
import { getDateInManaguaTimezone } from '../../utils/date';
import { IDescuentoGrupo } from '../../models/transaction/DescuentoGrupo.model';
import { ICaja } from '../../models/cashRegister/CashRegister.model';

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
        fechaRegistro: getDateInManaguaTimezone(),
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
            valor: new mongoose.Types.Decimal128(element.discount?.percentage.toString()!),
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
          fechaVencimiento: getDateInManaguaTimezone()
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
      
      
      venta.id = (newSale._id as mongoose.Types.ObjectId).toString();
      return venta;
    } catch (error) {
      console.log(error);

      
      

      throw new Error(error.message);
    }
  }
  async findByTypeAndBranch(sucursalId: string, type: TypeTransaction): Promise<ITransaccionResponse[]> {
    // Obtener todas las ventas de la sucursal especificada
    const transaccion = await this.repository.findByTypeAndBranch(sucursalId, type);
    let transactionDto: ITransaccionResponse[] = await this.mapperDataAll(transaccion);
  
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

 async mapperData(venta: ITransaccion, detalleVenta: IDetalleTransaccion[]): Promise<ITransaccionResponse> {
    let products: ITrasaccionProductoResponse[] = [];

    for await (const detalle of detalleVenta) {
      let descuento:IDescuentoAplicado | null = null;

      if (detalle.descuento.toString() !== "0") {
        
        let descuentoAplicado = await this.repository.findVentaDescuentosAplicadosByDetalleVentaId((detalle._id as mongoose.Types.ObjectId).toString());

        if (descuentoAplicado) {
          let tipoAplicacion = descuentoAplicado.tipoAplicacion;
          let descuentoTipo = descuentoAplicado.descuentosProductosId ? descuentoAplicado.descuentosProductosId : descuentoAplicado.descuentoGrupoId;
          let descuentoId = ((descuentoTipo as IDescuentosProductos).descuentoId as IDescuento);

          let productId = descuentoAplicado.descuentosProductosId ? (descuentoAplicado.descuentosProductosId as IDescuentosProductos).productId.toString() : null;
          let groupId = descuentoAplicado.descuentoGrupoId ? (descuentoAplicado.descuentoGrupoId as IDescuentoGrupo).grupoId.toString() : null;
          
          descuento = {
            id: (descuentoId._id as mongoose.Types.ObjectId).toString(),
            name: descuentoId.nombre,
            amount: descuentoId.valorDescuento ,
            percentage: Number(descuentoAplicado.valor),
            type: tipoAplicacion === "Product" ? "producto" : "grupo",
            productId: productId,
            groupId: groupId,
            sucursalId: (descuentoAplicado.detalleVentaId as mongoose.Types.ObjectId).toString(),
            fechaInicio: descuentoId.fechaInicio,
            fechaFin: descuentoId.fechaFin,
            minimoCompra: descuentoId.minimoCompra,
            minimoCantidad: descuentoId.minimoCantidad,
            activo: descuentoId.activo
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

    let ventaDto: ITransaccionResponse = {
      userId: ((venta.usuarioId as IUser)._id as Types.ObjectId).toString(),
      sucursalId: venta.sucursalId.toString(),
      subtotal: Number(venta.subtotal),
      total: Number(venta.total),
      discount: Number(venta.descuento),
      fechaRegistro: venta.fechaRegistro,
      products: products,
      paymentMethod: venta.paymentMethod,
      tipoTransaccion: venta.tipoTransaccion,
      id: (venta._id as mongoose.Types.ObjectId).toString()
    }

    return ventaDto;
  }

  async mapperDataAll(ventas: ITransaccion[]): Promise<ITransaccionResponse[]> {

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

    let sucursalIdStr = transaccion.transaccion.sucursalId.toString();

    let productIdsByBranch = data.products?.map((detalle) => detalle.productId) as string[];

      let dataInit:IInit = {
        userId: data.userId,
        branchId: sucursalIdStr,
        listInventarioSucursalId: [],
        listProductId: productIdsByBranch,
        searchWithProductId: true
      }

      let listInventarioSucursal = await this.inventoryManagementService.init(dataInit);

      let sucursalId = transaccion.transaccion.sucursalId;
      let usuarioId = new mongoose.Types.ObjectId(data.userId!);
      let cajaId = new mongoose.Types.ObjectId(data.cajaId!);

      let getDetalleVenta = (productId:string) => {
        let productoIdObj = new mongoose.Types.ObjectId(productId);
        let detalleVenta = transaccion.datalleTransaccion.find((item) => ((item.productoId as IProducto)._id  as mongoose.Types.ObjectId).toString() === productoIdObj.toString());

        return detalleVenta
      }

      let getProductoPrice = (productId:string) => {
        let detalleVenta = getDetalleVenta(productId)
        let price = parseFloat((detalleVenta?.subtotal as mongoose.Types.Decimal128).toString()) / (detalleVenta?.cantidad as number);

        return price
      }

      let totalDevolucion = data.monto + (data.montoExterno ?? 0);
      let totalDevolucion128 = new mongoose.Types.Decimal128(totalDevolucion.toString());

      let newTotalTransaccion = restarDecimal128(transaccion.transaccion.total, totalDevolucion128)
      let subTotalTransaccion = cero128;

      let newVenta = {
        usuarioId: usuarioId,
        sucursalId: sucursalId,
        subtotal: totalDevolucion128,
        total: totalDevolucion128,
        descuento: new mongoose.Types.Decimal128("0"),
        deleted_at: null,
        fechaRegistro: getDateInManaguaTimezone(),
        tipoTransaccion: ('DEVOLUCION' as TypeTransaction),
        paymentMethod: transaccion.transaccion.paymentMethod,
        entidadId : (transaccion?.transaccion as ITransaccion).entidadId,
        estadoTrasaccion: tipoEstatusSales.DEVOLUCION,
        cajaId: cajaId,
        transaccionOrigenId: transaccion.transaccion._id as mongoose.Types.ObjectId,
      }

      const tipoTransaccionDevolucion = transaccion.transaccion.tipoTransaccion === TypeTransaction.VENTA ? TypeTransaction.COMPRA : TypeTransaction.VENTA

      const newReturn = await this.repository.create(newVenta);

      for await (const element of data.products!) {
        let detalleTransaccionOrigen = getDetalleVenta(element.productId) as IDetalleTransaccion;
        let productoId = new mongoose.Types.ObjectId(element.productId);

        let inventarioSucursal = listInventarioSucursal.find((item) => formatObejectId((item.productoId as IProducto)._id).toString() === productoId.toString()) as IInventarioSucursal;
        let inventarioSucursalId = (inventarioSucursal._id as Types.ObjectId)

        let quantity128 = new mongoose.Types.Decimal128(element.quantity.toString());

        let precioApplyDiscount = dividirDecimal128(detalleTransaccionOrigen.total, quantity128);

        let precio = element.discountApplied ? precioApplyDiscount : inventarioSucursal.precio;
        let subTotal128 = multiplicarDecimal128(inventarioSucursal.precio, quantity128);
        subTotalTransaccion = restarDecimal128(transaccion.transaccion.subtotal, subTotal128);

        let total = multiplicarDecimal128(precio, quantity128)
        let tipoAplicacion:ITipoDescuentoEntidad = 'Product';

        let detalleVenta = {
          ventaId: (newReturn._id as mongoose.Types.ObjectId),
          productoId: productoId,
          precio: precio,
          cantidad: element.quantity,
          subtotal: subTotal128,
          total: total,
          descuento: cero128,
          deleted_at: null,
          tipoCliente: 'Regular' as 'Regular',
          tipoDescuentoEntidad: tipoAplicacion,
        }

        let newdDetailReturn = await this.repository.createDetalleVenta(detalleVenta);

        if (tipoTransaccionDevolucion === 'COMPRA') {

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
          
        } else if (tipoTransaccionDevolucion === 'VENTA') {
          let dataAddQuantity:IAddQuantity = {
            quantity: element.quantity,
            inventarioSucursalId: inventarioSucursalId,
            isNoSave:true,
            tipoMovimiento:  tipoMovimientoInventario.DEVOLUCION,
          };
  
          await this.inventoryManagementService.addQuantity(dataAddQuantity)
        }

        (newReturn.transactionDetails as mongoose.Types.ObjectId[]).push(newdDetailReturn._id as mongoose.Types.ObjectId);


        if (newTotalTransaccion > cero128) {
          if (detalleTransaccionOrigen) {
            if (detalleTransaccionOrigen.cantidad === element.quantity) {
              detalleTransaccionOrigen.deleted_at = getDateInManaguaTimezone();
              await detalleTransaccionOrigen.save();
              
            } else {
              
              detalleTransaccionOrigen.cantidad = detalleTransaccionOrigen.cantidad - element.quantity;
              await detalleTransaccionOrigen.save();
            }
          }
        }
      }

      if (newTotalTransaccion === cero128) {
        transaccion.transaccion.deleted_at = getDateInManaguaTimezone();
        await transaccion.transaccion.save();
      } else {
        transaccion.transaccion.subtotal = subTotalTransaccion;
        transaccion.transaccion.total = newTotalTransaccion
        await transaccion.transaccion.save();
      }

      await this.inventoryManagementService.updateAllBranchInventory();
      await this.inventoryManagementService.saveAllMovimientoInventario();

      let ventaActualizar = {
        id: newReturn._id as Types.ObjectId,
        tipoTransaccion: tipoTransaccionDevolucion,
        cajaId: (newReturn.cajaId as Types.ObjectId).toString(),
        userId: data.userId,
        total: totalDevolucion,
        subtotal: totalDevolucion,
        monto: data.monto,
        cambioCliente: 0,

      } as ITransactionCreateCaja;

      const datosActualizar = {
        data: ventaActualizar,   
      }

      let caja: ICaja | null = null

      if (transaccion.transaccion.paymentMethod === 'credit') {
        const dineroADevolver = await this.creditoService.returnTransactionById(data.trasaccionOrigenId, totalDevolucion);

        ventaActualizar.total = dineroADevolver;
        ventaActualizar.monto = dineroADevolver;

        caja = await this.cashRegisterService.actualizarMontoEsperadoByTrasaccion(datosActualizar!); 
      }

      await newReturn.save();
      
      if (transaccion.transaccion.paymentMethod === 'cash') {
        caja = await this.cashRegisterService.actualizarMontoEsperadoByTrasaccion(datosActualizar!); 
      }

      await this.resumenRepository.addTransactionDailySummary(newReturn, sucursalId as Types.ObjectId);

      return { devolucion:newReturn, transaccionOriginal: transaccion.transaccion, caja: caja } 
  }
}
