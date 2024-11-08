import { injectable, inject } from 'tsyringe';
import {
  IResponseToAddCantidad,
  ISendTrasladoProducto,
  ITraslado,
  ITrasladoEnvio,
  ITrasladoRecepcion,
  Traslado,
} from '../../models/traslados/Traslado.model';
import {
  IDetalleTraslado,
  IDetalleTrasladoCreate,
  IDetalleTrasladoEnvio,
  IDetalleTrasladoRecepcion,
} from '../../models/traslados/DetalleTraslado.model';
import { InventoryManagementService } from './InventoryManagement.service';
import mongoose, { Types } from 'mongoose';
import { TrasladoRepository } from '../../repositories/traslado/traslado.repository';
import { InventarioSucursalRepository } from '../../repositories/inventary/inventarioSucursal.repository';
import fileUploadService from '../utils/fileUploadService';
import { IFilesUpload } from '../../gen/files';
import shortid from 'shortid';
import { IInventarioSucursal, InventarioSucursal } from '../../models/inventario/InventarioSucursal.model';
import { Request } from 'express';
import { MovimientoInventario } from '../../models/inventario/MovimientoInventario.model';
import { ISucursal } from '../../models/sucursales/Sucursal.model';
import { IProducto } from '../../models/inventario/Producto.model';
import { SucursalRepository } from '../../repositories/sucursal/sucursal.repository';
import { CustomJwtPayload } from '../../utils/jwt';
import { notifyTelegramManagerOfIncomingProducts, notifyTelergramReorderThreshold } from '../utils/telegramServices';
import { IAddCantidadTraslado, IGenerateItemDePedidoByPedido, IGeneratePedidoHerramienta, ISendPedidoHerramienta, ISubtractCantidadByDetalleTraslado } from '../../interface/ITraslado';
import { IInit } from '../../interface/IInventario';

@injectable()
export class TrasladoService {
  constructor(
    @inject(InventoryManagementService) private inventoryManagementService: InventoryManagementService,
    @inject(TrasladoRepository) private trasladoRepository: TrasladoRepository,
    @inject(InventarioSucursalRepository) private inventarioSucursalRepo: InventarioSucursalRepository,
    @inject(SucursalRepository) private sucursalRepo: SucursalRepository
  ) {}

  async postCreateEnvioProducto(
    model: Partial<ITrasladoEnvio>,
    user: CustomJwtPayload
  ): Promise<ITraslado> {
    let listDetalleTraslado: IDetalleTrasladoEnvio[] =
      model.listDetalleTraslado!;

    model.listDetalleTraslado = listDetalleTraslado;

    let listInventarioSucursalIds = model.listDetalleTraslado.map((detalle) =>
      (detalle.inventarioSucursalId as Types.ObjectId).toString()
    );

    let dataInit:IInit = {
      branchId: model.sucursalOrigenId!,
      listInventarioSucursalId: listInventarioSucursalIds,
      userId: model.usuarioIdEnvia!
    }

    this.inventoryManagementService.init(dataInit);

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      let dataGeneratePedido:IGeneratePedidoHerramienta = {
        session,
        sucursalEnviaId: model.sucursalOrigenId!,
        sucursalRecibeId: model.sucursalDestinoId!
      }

      var traslado = await this.generatePedidoHerramienta(dataGeneratePedido );

        let dataFiles: IFilesUpload[] = model.archivosAdjuntos?.map((file) => {
          return { base64: file, name: shortid.generate() } as IFilesUpload;
        }) as IFilesUpload[];
    
        const archivosAdjuntos =  dataFiles.length ? await fileUploadService.uploadFiles(dataFiles) : [];

      traslado.archivosAdjuntos = archivosAdjuntos;

      let dataGenerateItemDePedidoByPedido:IGenerateItemDePedidoByPedido = {
        trasladoId: (traslado._id as mongoose.Types.ObjectId).toString(),
        listDetalleTraslado: model.listDetalleTraslado,
        isNoSave: false,
        session: session
      }

      var listItemDePedidos = await this.generateItemDePedidoByPedido(dataGenerateItemDePedidoByPedido);
      
      let dataSubtractCantidad:ISubtractCantidadByDetalleTraslado = {
        listItems:listItemDePedidos,
        session: session
      }
      await this.subtractCantidadByDetalleTraslado(dataSubtractCantidad);

      //  Haciendo el envio del pedido

      const firmaEnvio = await fileUploadService.uploadFile(model.firmaEnvio!, shortid.generate());

      let sendTrasladoProducto = {
        firmaEnvio: model.firmaEnvio == 'undefined' ? '' : firmaEnvio,
        comentarioEnvio: model.comentarioEnvio!,
        trasladoId: traslado._id as mongoose.Types.ObjectId,
        traslado: traslado,
      };

      let dataSendPedido:ISendPedidoHerramienta = {
        model: sendTrasladoProducto,
        session: session,
        usuarioEnviaId: model.usuarioIdEnvia!
      }

      await this.sendPedidoHerramienta(dataSendPedido);

      let usuario = await this.sucursalRepo.findUserAdminForBranch((traslado.sucursalDestinoId._id as mongoose.Types.ObjectId).toString());

      await session.commitTransaction();
      session.endSession();

      let username = usuario?.username || 'Sin administrador';
      let channel = "#pedidos";
      let channel2 = "#alertas-reorden";
      let branchName = (traslado.sucursalDestinoId as ISucursal).nombre;
      let originBranch = (traslado.sucursalOrigenId as ISucursal).nombre;
      let orderId = (traslado._id as mongoose.Types.ObjectId).toString();

      let pedidosChannelTelegram = "-1002348544066"
      let puntoReCompraTelegram = "-4560332210"


      let productList = listItemDePedidos.map((item) => ({
        name: ((item.inventarioSucursalId as IInventarioSucursal).productoId as IProducto).nombre,
        quantity: item.cantidad,
      }));

      let productListReOrder = listItemDePedidos
        .filter((item) => (item.inventarioSucursalId as IInventarioSucursal).stock < (item.inventarioSucursalId as IInventarioSucursal).puntoReCompra)
        .map((item) => ({
          name: ((item.inventarioSucursalId as IInventarioSucursal).productoId as IProducto).nombre,
          currentQuantity: (item.inventarioSucursalId as IInventarioSucursal).stock,
          reorderPoint: (item.inventarioSucursalId as IInventarioSucursal).puntoReCompra,
        }));

      // notifyManagerOfIncomingProducts(username, branchName, productList, orderId, originBranch, channel);
      // notifyReorderThreshold(username, branchName, productListReOrder, channel2);
      // notifyWhatsappManagerOfIncomingProducts(username, branchName, productList, orderId, originBranch, user.username);
      // listItemDePedidos.length > 0 && notifyWhatsappReorderThreshold(username, branchName, productListReOrder);

      notifyTelegramManagerOfIncomingProducts(username, branchName, productList, orderId, originBranch, user.username, pedidosChannelTelegram);
      listItemDePedidos.length > 0 && notifyTelergramReorderThreshold(username, branchName, productListReOrder, puntoReCompraTelegram);

      return traslado;
    } catch (error) {
      console.log(error);

      await session.abortTransaction();
      session.endSession();

      throw new Error(error.message);
    }
  }

  async postRecibirPedido(model: Partial<ITrasladoRecepcion>) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();
      this.inventoryManagementService.initHandleStockProductBranch(model.usuarioIdRecibe!);

      var pedido = (await this.trasladoRepository.findById(model.trasladoId!)) as ITraslado;
      var listItemDePedidos = await this.trasladoRepository.findAllItemDePedidoByPedido(model.trasladoId!);

      var trabajadorId = model.usuarioIdRecibe!;

      // Actualizando el pedido
      pedido.estatusTraslado = 'Terminado';
      pedido.fechaRecepcion = new Date();
      pedido.comentarioRecepcion = model.comentarioRecepcion!;
      pedido.usuarioIdRecibe = new mongoose.Types.ObjectId(trabajadorId);

      let dataFiles: IFilesUpload[] = model.archivosAdjuntosRecibido?.map((file) => {
        return { base64: file, name: shortid.generate() } as IFilesUpload;
      }) as IFilesUpload[];
  
      const archivosAdjuntos = dataFiles.length ? await fileUploadService.uploadFiles(dataFiles) : [];

      pedido.archivosAdjuntosRecibido = archivosAdjuntos;

      if (
        model.listDetalleTraslado?.filter((detalle) => detalle.recibido)
          .length !== listItemDePedidos.length
      ) {
        pedido.estatusTraslado = 'Terminado incompleto';
      }

      const firmaRecepcion = await fileUploadService.uploadFile(model.firmaRecepcion!, shortid.generate());

      pedido.firmaRecepcion = firmaRecepcion;

      let listResponseAdd: IResponseToAddCantidad = {
        listHistorialInventario: [],
        listDetalleTrasladoAgregados: [],
        listDetalleTrasladoActualizado: [],
        listInventarioSucursalAgregados: [],
        listInventarioSucursalActualizado: [],
      }

      for await (const element of model.listDetalleTraslado!) {

        let dataAddCantidad:IAddCantidadTraslado = {
          model: element,
          bodegaId: (pedido.sucursalDestinoId._id as mongoose.Types.ObjectId).toString(),
          listFiles: element.archivosAdjuntosRecibido as string[],
          session: session,
          _detalleTralado: listItemDePedidos as IDetalleTraslado[]
        }

        let responseAdd = await this.addCantidad(dataAddCantidad);

        var item2 = listItemDePedidos.find(
          (x) =>
            (x.inventarioSucursalId as mongoose.Types.ObjectId).toString() ===
            element.inventarioSucursalId.toString()
        ) as IDetalleTraslado;

        if (item2.cantidad > element.cantidad) {
          pedido.estatusTraslado = 'Terminado incompleto';
        }
        listResponseAdd.listDetalleTrasladoActualizado.concat(responseAdd.listDetalleTrasladoActualizado);
        listResponseAdd.listDetalleTrasladoAgregados.concat(responseAdd.listDetalleTrasladoAgregados);
      }

      let DTAdd = listResponseAdd.listDetalleTrasladoAgregados
      let DTUpdate = listResponseAdd.listDetalleTrasladoActualizado

      await this.trasladoRepository.saveAllDetalleTraslado(DTAdd, session);
      await this.trasladoRepository.updateAllDetalleTraslado(DTUpdate, session);
      await this.inventoryManagementService.saveAllBranchInventory(session);
      await this.inventoryManagementService.updateAllBranchInventory(session);
      await this.inventoryManagementService.saveAllMovimientoInventario(session);

      await pedido.save({session});

      await session.commitTransaction();
      session.endSession();

      return pedido;
    } catch (error) {
      console.log(error);

      await session.abortTransaction();
      session.endSession();

      throw new Error(error.message);
    }
  }

  async findPedidoEnviadosBySucursal(sucursalId: string) {
    try {
      const listItemDePedidos =
        await this.trasladoRepository.findPedidoEnviadosBySucursal(sucursalId);

      return listItemDePedidos;
    } catch (error) {
      console.error('Error al obtener los pedidos enviados:', error);
      throw new Error('Error al obtener los pedidos enviados');
    }
  }

  async findPedidoRecibidosBySucursal(sucursalId: string) {
    try {
      const listItemDePedidos =
        await this.trasladoRepository.findPedidoRecibidosBySucursal(sucursalId);

      return listItemDePedidos;
    } catch (error) {
      console.error('Error al obtener los pedidos recibidos:', error);
      throw new Error('Error al obtener los pedidos recibidos');
    }
  }

  async findPedidoPorRecibirBySucursal(sucursalId: string) {
    try {
      const listItemDePedidos =
        await this.trasladoRepository.findPedidoPorRecibirBySucursal(
          sucursalId
        );

      return listItemDePedidos;
    } catch (error) {
      console.error('Error al obtener los pedidos por recibir:', error);
      throw new Error('Error al obtener los pedidos por recibir');
    }
  }

  async findPedidoEnProcesoBySucursal(sucursalId: string) {
    try {
      const listItemDePedidos =
        await this.trasladoRepository.findPedidoEnProcesoBySucursal(sucursalId);

      return listItemDePedidos;
    } catch (error) {
      console.error('Error al obtener los pedidos en proceso:', error);
      throw new Error('Error al obtener los pedidos en proceso');
    }
  }

  async findAllItemDePedidoByPedidoDto(pedidoId: string) {
    try {
      const listItemDePedidos =
        await this.trasladoRepository.findAllItemDePedidoByPedidoDto(pedidoId);

      return listItemDePedidos;
    } catch (error) {
      console.error('Error al obtener los item de pedido:', error);
      throw new Error('Error al obtener los item de pedido');
    }
  }

  async findPedidoById(pedidoId: string) {
    try {
      const pedido = await this.trasladoRepository.findById(pedidoId);

      return pedido;
    } catch (error) {
      console.error('Error al obtener el pedido:', error);
      throw new Error('Error al obtener el pedido');
    }
  }
  async returnProductToBranch(itemDePedidoId: string, req:Request) {
    const session = await mongoose.startSession();

    try {

      session.startTransaction();

      const itemDePedido = (await this.trasladoRepository.findItemDePedidoById(itemDePedidoId) as IDetalleTraslado);
      const inventarioSucursal = (await this.inventarioSucursalRepo.findById(itemDePedido.inventarioSucursalId.toString()) as IInventarioSucursal);

      itemDePedido.regresado = true;
     
      inventarioSucursal.stock += itemDePedido.cantidad;
      inventarioSucursal.ultimo_movimiento = new Date();

      inventarioSucursal.save({ session });
      itemDePedido.save({ session });

      let user = req.user;

      let movimientoInventario = new MovimientoInventario({
        inventarioSucursalId: inventarioSucursal._id,
        cantidadCambiada: itemDePedido.cantidad,
        cantidadInicial: inventarioSucursal.stock,
        cantidadFinal: inventarioSucursal.stock - itemDePedido.cantidad,
        tipoMovimiento: 'devolución',
        fechaMovimiento: new Date(),
        usuarioId: user?.id,
      });

      movimientoInventario.save({ session });

      await session.commitTransaction();
      session.endSession();

      return inventarioSucursal;
    } catch (error) {

      await session.abortTransaction();
      session.endSession();

      console.error('Error al obtener el pedido:', error);
      throw new Error('Error al obtener el pedido');
    }
  }

  // logic crear pedido

  async generatePedidoHerramienta({ session, sucursalEnviaId, sucursalRecibeId }: IGeneratePedidoHerramienta) {

    const sucursalEnviaIdParsed = new mongoose.Types.ObjectId(sucursalEnviaId);
    const sucursalRecibeIdParsed = new mongoose.Types.ObjectId(sucursalRecibeId);

    const ultimoPedido = await this.trasladoRepository.getLastTrasladoBySucursalId(sucursalEnviaId);

    const newConsecutivo = ultimoPedido?.consecutivo
      ? ultimoPedido.consecutivo + 1
      : 1;

    const newPedido = new Traslado({
      estatusTraslado: 'Solicitado',
      fechaRegistro: new Date(),
      tipoPedido: 0,
      estado: true,
      consecutivo: newConsecutivo,
      nombre: `Pedido #${newConsecutivo}`,
      sucursalDestinoId: sucursalRecibeIdParsed,
      sucursalOrigenId: sucursalEnviaIdParsed,
    });

    return (await newPedido.save({ session })).populate([
      'sucursalOrigenId',
      'sucursalDestinoId',
      'usuarioIdEnvia',
      'usuarioIdRecibe',
    ]);
  }

  async sendPedidoHerramienta({ model, session, usuarioEnviaId }: ISendPedidoHerramienta): Promise<void> {
    let traslado = model.traslado;
    let trasladoId = (traslado._id as mongoose.Types.ObjectId).toString();

    if (!traslado && trasladoId) {
      traslado = (await this.trasladoRepository.findById(
        trasladoId
      )) as ITraslado;
    }

    if (!traslado) throw new Error('Pedido no encontrado');

    traslado.estatusTraslado = 'En Proceso';
    traslado.fechaEnvio = new Date();
    traslado.usuarioIdEnvia = new mongoose.Types.ObjectId(usuarioEnviaId);

    // Firma
    if (model.firmaEnvio) {
      traslado.firmaEnvio = model.firmaEnvio;
    }

    traslado.comentarioEnvio = model.comentarioEnvio;
    traslado.archivosAdjuntos = model.traslado.archivosAdjuntos;

    await this.trasladoRepository.update(trasladoId, traslado, session);
  }

  public async generateItemDePedidoByPedido({
    trasladoId,
    listDetalleTraslado,
    isNoSave = false,
    session,
  }: IGenerateItemDePedidoByPedido): Promise<IDetalleTrasladoCreate[]> {
    let listItems: IDetalleTrasladoCreate[] = [];

    for (const producto of listDetalleTraslado) {
      let trasladoIdParsed = new mongoose.Types.ObjectId(trasladoId);

      let archivosAdjuntosStr: string[] = (isNoSave ? producto.archivosAdjuntosRecibido : (producto as IDetalleTrasladoEnvio).archivosAdjuntos as string[]) || [];

      let dataFiles: IFilesUpload[] = archivosAdjuntosStr.map((file) => {
        return { base64: file, name: shortid.generate() } as IFilesUpload;
      }) as IFilesUpload[];

      const archivosAdjuntos = await fileUploadService.uploadFiles(dataFiles);

      // Crear el objeto ItemDePedido
      const detalleTraslado: IDetalleTrasladoCreate = {
        cantidad: producto.cantidad,
        trasladoId: trasladoIdParsed,
        inventarioSucursalId: producto.inventarioSucursalId,
        archivosAdjuntos: (isNoSave ? (producto as IDetalleTrasladoEnvio).archivosAdjuntos : archivosAdjuntos as string[]) || [],
        archivosAdjuntosRecibido: (isNoSave ?  archivosAdjuntos : (producto as IDetalleTrasladoRecepcion).archivosAdjuntosRecibido  as string[]) || [],
        deleted_at: null,
        comentarioEnvio: (producto as IDetalleTrasladoEnvio).comentarioEnvio,
        comentarioRecepcion: (producto as IDetalleTrasladoRecepcion).comentarioRecibido || "",
      };

      listItems.push(detalleTraslado);
    }

    // Guardar en la base de datos si `isNoSave` es falso
    if (!isNoSave) {
     let newItems = await this.trasladoRepository.saveAllDetalleTraslado(listItems, session);
     listItems = newItems;
    }

    return listItems;
  }

  async subtractCantidadByDetalleTraslado({ listItems, session }:ISubtractCantidadByDetalleTraslado): Promise<void> {
    for await (const item of listItems) {
      await this.inventoryManagementService.subtractQuantity(
        {
          quantity: item.cantidad,
          inventarioSucursalId: item.inventarioSucursalId._id as mongoose.Types.ObjectId,
          session: session,
          isNoSave: true
        }
      );
    }

    await this.inventoryManagementService.updateAllBranchInventory(session);
    await this.inventoryManagementService.saveAllMovimientoInventario(session);
  }

  public async addCantidad({ model, bodegaId, listFiles, session, _detalleTralado }: IAddCantidadTraslado): Promise<IResponseToAddCantidad> {
    // Inicialización del response
    const response: IResponseToAddCantidad = {
      listHistorialInventario: [],
      listDetalleTrasladoAgregados: [],
      listDetalleTrasladoActualizado: [],
      listInventarioSucursalAgregados: [],
      listInventarioSucursalActualizado: [],
    };

    // Validación inicial
    const inventarioSucursalEnvia = await this.inventarioSucursalRepo.findById(
      model.inventarioSucursalId.toString()
    );

    if (!inventarioSucursalEnvia) {
      throw new Error(
        'No se encontro en el inventario de la sucursal el producto.'
      );
    }

    const itemDePedido = _detalleTralado.find(
      (a) =>
        (a.inventarioSucursalId as mongoose.Types.ObjectId).toString() ===
        model.inventarioSucursalId.toString()
    ) as IDetalleTraslado;

    if (!itemDePedido) {
      throw new Error('Item de pedido no encontrado');
    }

    itemDePedido.recibido = model.recibido;
    itemDePedido.comentarioRecepcion = model.comentarioRecibido;
    itemDePedido.estadoProducto = model.estadoProducto;

    if (itemDePedido.archivosAdjuntos === null) {
      itemDePedido.archivosAdjuntos = [];
    }

    //manejo de cantidad 0
    if (model.cantidad == 0) {
      itemDePedido.recibido = false;
    }

    // Manejo de cantidades menores
    if ((itemDePedido.cantidad > model.cantidad) && model.cantidad > 0) {
      itemDePedido.recibido = false;
      itemDePedido.cantidad -= model.cantidad;

      const herramientaModel: IDetalleTrasladoEnvio = {
        cantidad: model.cantidad,
        inventarioSucursalId: itemDePedido.inventarioSucursalId,
        archivosAdjuntosRecibido: listFiles,
        precio: model.precio,
        comentarioRecibido: model.comentarioRecibido,
      };

      let list: IDetalleTrasladoEnvio[] = [];
      list.push(herramientaModel);

      let dataGenerateItemDePedidoByPedido:IGenerateItemDePedidoByPedido = {
        isNoSave: true,
        trasladoId: (itemDePedido.trasladoId as mongoose.Types.ObjectId).toString(),
        listDetalleTraslado: list,
        session: session
      }

      let newItemsDePedido = await this.generateItemDePedidoByPedido(dataGenerateItemDePedidoByPedido);

      itemDePedido.archivosAdjuntosRecibido = newItemsDePedido[0].archivosAdjuntosRecibido as string[];

      newItemsDePedido.forEach((item) => (item.recibido = true));
      newItemsDePedido.forEach((item) => (item.estadoProducto = "En Buen Estado"));
      response.listDetalleTrasladoAgregados.push(...newItemsDePedido);
    } else {

      let dataFiles: IFilesUpload[] = listFiles.map((file) => {
        return { base64: file, name: shortid.generate() } as IFilesUpload;
      }) as IFilesUpload[];

      const archivosAdjuntos = await fileUploadService.uploadFiles(dataFiles);

      if (listFiles.length > 0) {
        itemDePedido.archivosAdjuntosRecibido = archivosAdjuntos;
      }
    }

    // Actualización de cantidades en bodega
    if (model.recibido && model.cantidad > 0) {
      const inventarioSucursal = new InventarioSucursal({
        stock: model.cantidad,
        sucursalId: new mongoose.Types.ObjectId(bodegaId),
        productoId: inventarioSucursalEnvia.productoId,
        ultimo_movimiento: new Date(),
        deleted_at: null,
        precio: model.precio,
        puntoReCompra: model.puntoReCompra,
      });

      let dataHandle = {
        session: session,
        model: inventarioSucursal,
        quantity: model.cantidad
      }

      await this.inventoryManagementService.handleStockProductBranch(dataHandle);
    }

    response.listDetalleTrasladoActualizado.push(itemDePedido);

    return response;
  }
}
