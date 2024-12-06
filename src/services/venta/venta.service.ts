import { injectable, inject } from 'tsyringe';
import { VentaRepository } from '../../repositories/venta/venta.repository';
import mongoose, { Types } from 'mongoose';
import { ITransaccion, IVentaCreate, IVentaDescuento, IVentaProducto, TypeTransaction } from '../../models/Ventas/Venta.model';
import { ITipoDescuento } from '../../models/Ventas/VentaDescuentosAplicados.model';
import { IDetalleVenta } from '../../models/Ventas/DetalleVenta.model';
import { IProducto } from '../../models/inventario/Producto.model';
import { IInventarioSucursal } from '../../models/inventario/InventarioSucursal.model';
import { IUser } from '../../models/usuarios/User.model';
import { CustomJwtPayload } from '../../utils/jwt';
import { ISucursal } from '../../models/sucursales/Sucursal.model';
import { inventarioQueue } from '../../queues/inventarioQueue';
import { InventoryManagementService } from '../traslado/InventoryManagement.service';
import { IInit, ISubtractQuantity, tipoMovimientoInventario } from '../../interface/IInventario';
import { IDescuento, ITipoDescuentoEntidad } from '../../models/Ventas/Descuento.model';
import { notifyTelergramReorderThreshold } from '../utils/telegramServices';
import { DescuentoRepository } from '../../repositories/venta/descuento.repository';
import { IDescuentosProductos } from '../../models/Ventas/DescuentosProductos.model'; 
import { CashRegisterService } from '../utils/cashRegister.service';
import { IVentaCreateCaja } from '../../interface/ICaja';
import { ICredito, ModalidadCredito } from '../../models/credito/Credito.model';
import { CreditoService } from '../credito/Credito.service';

export interface ICreateVentaProps {
  venta: Partial<IVentaCreate>;
  user: CustomJwtPayload;
}

@injectable()
export class VentaService {
  constructor(
    @inject(VentaRepository) private repository: VentaRepository,
    @inject(InventoryManagementService) private inventoryManagementService: InventoryManagementService,
    @inject(DescuentoRepository) private descuentoRepository: DescuentoRepository,
    @inject(CashRegisterService) private cashRegisterService: CashRegisterService,
    @inject(CreditoService) private creditoService: CreditoService,
  ) {}

  async addSaleToQueue(data: ICreateVentaProps) {
    const result = await inventarioQueue.add(data, { delay: 0, maxAttempts: 3, backoff: 10000, ttl: 300000 });
    return result;
  }

  async createVenta(data: ICreateVentaProps): Promise<Partial<IVentaCreate>> {
    const { venta, user } = data;
    venta.tipoTransaccion = "VENTA";

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

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
        tipoTransaccion: 'VENTA' as TypeTransaction

      }

      const newSale = await this.repository.create(newVenta, session);

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

        let newdDetalleVenta = await this.repository.createDetalleVenta(detalleVenta, session);
        
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
  
          await this.repository.createVentaDescuentosAplicados(ventaDescuentosAplicados, session);
        }

        let dataSubTractQuantity:ISubtractQuantity = {
          inventarioSucursalId: new mongoose.mongo.ObjectId(element.inventarioSucursalId) ,
          quantity: element.quantity,
          session,
          isNoSave:true,
          tipoMovimiento: tipoMovimientoInventario.VENTA
        }
        
       let inventarioSucursal = (await this.inventoryManagementService.subtractQuantity(dataSubTractQuantity) as IInventarioSucursal)

       if (inventarioSucursal.stock <= inventarioSucursal.puntoReCompra) {
          listInventarioSucursal.push(inventarioSucursal);
        }
      }
 
      await this.inventoryManagementService.updateAllBranchInventory(session);
      await this.inventoryManagementService.saveAllMovimientoInventario(session);

      let ventaActualizar = ({...data.venta, id: (newSale._id as Types.ObjectId).toString(), } as IVentaCreateCaja);

      const datosActualizar = {
        data: ventaActualizar,
        session
      }

      await this.cashRegisterService.actualizarMontoEsperadoByVenta(datosActualizar!);

      if (newSale.paymentMethod === 'credit') {
        let credito:Partial<ICredito> = {
          sucursalId: new mongoose.Types.ObjectId(venta.sucursalId!),
          entidadId: new mongoose.Types.ObjectId(venta.entidadId!),
          transaccionId: new mongoose.Types.ObjectId(newSale._id as mongoose.Types.ObjectId),
          tipoCredito: venta.tipoTransaccion as 'VENTA' | 'COMPRA',
          modalidadCredito: venta.credito?.modalidadCredito as ModalidadCredito,
          saldoCredito: new mongoose.Types.Decimal128(`${venta.monto}`),
          plazoCredito: venta.credito?.plazoCredito as number,
          cuotaMensual: venta.credito?.cuotaMensual as mongoose.Types.Decimal128,
          pagoMinimoMensual: venta.credito?.pagoMinimoMensual as mongoose.Types.Decimal128,
          fechaVencimiento: new Date()
        }

        await this.creditoService.createCredito(credito, session);
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
      await session.commitTransaction();
      session.endSession();

      return venta;
    } catch (error) {
      console.log(error);

      await session.abortTransaction();
      session.endSession();

      throw new Error(error.message);
    }
  }
  async getVentasBySucursal(sucursalId: string): Promise<IVentaCreate[]> {
    // Obtener todas las ventas de la sucursal especificada
    const ventas = await this.repository.findAllVentaBySucursalId(sucursalId);
    let ventasDto: IVentaCreate[] = [];
  
    // Iterar sobre cada venta y obtener los detalles de venta
    for (const venta of ventas) {
      const detalleVenta = await this.repository.findAllDetalleVentaByVentaId((venta._id as Types.ObjectId).toString());
      const ventaDto = (await this.mapperData(venta, detalleVenta) as IVentaCreate);
      ventasDto.push(ventaDto);
    }
  
    return ventasDto;
  }
  async findAllVentaBySucursalIdAndUserId(sucursalId: string, userId: string): Promise<IVentaCreate[]> {
    const ventas = await this.repository.findAllVentaBySucursalIdAndUserId(sucursalId, userId);

    let ventasDto: IVentaCreate[] = [];
  
    // Iterar sobre cada venta y obtener los detalles de venta
    for (const venta of ventas) {
      const detalleVenta = await this.repository.findAllDetalleVentaByVentaId((venta._id as Types.ObjectId).toString());
      const ventaDto = (await this.mapperData(venta, detalleVenta) as IVentaCreate);
      ventasDto.push(ventaDto);
    }
  
    return ventasDto;
  }

  async getAllVentasBySucursalIdAndUserId(sucursalId: string, userId: string): Promise<ITransaccion[]> {
    return this.repository.findAllVentaBySucursalIdAndUserId(sucursalId, userId);
  }

  async getVentaById(id: string): Promise<IVentaCreate | null> {
    let venta = (await this.repository.findVentaById(id) as ITransaccion);

    let detalleVenta = await this.repository.findAllDetalleVentaByVentaId(id);

    let ventaDto:IVentaCreate = (await this.mapperData(venta, detalleVenta) as IVentaCreate);

    return ventaDto;
  }

 async mapperData(venta: ITransaccion, detalleVenta: IDetalleVenta[]): Promise<IVentaCreate | null> {
    let products: IVentaProducto[] = [];

    for await (const detalle of detalleVenta) {
      let descuento:IVentaDescuento | null = null;

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

    let ventaDto: IVentaCreate = {
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

  async getAllDetalleVentaByVentaId(ventaId: string): Promise<IDetalleVenta[]> {
    return this.repository.findAllDetalleVentaByVentaId(ventaId);
  }
}
