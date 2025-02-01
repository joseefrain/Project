import { injectable, inject } from 'tsyringe';
import {
  IDescuento,
  IDescuentoCreate,
  IDescuentoCreateResponse,
  IDescuentoDeleteParams,
  IListDescuentoResponse,
} from '../../models/transaction/Descuento.model';
import { DescuentoRepository } from '../../repositories/transaction/descuento.repository';
import mongoose, { DeleteResult, Types } from 'mongoose';
import { ITransaccionDescuentosAplicados } from '../../models/transaction/TransactionDescuentosAplicados.model';
import { IDescuentosProductos } from '../../models/transaction/DescuentosProductos.model';

@injectable()
export class DescuentoService {
  constructor(
    @inject(DescuentoRepository) private repository: DescuentoRepository
  ) {}

  async createDescuento(data: Partial<IDescuentoCreate>): Promise<IDescuentoCreateResponse> {
    
    try {

      let minimoCompra = data.minimoCompra ? data.minimoCompra : undefined;
      let minimoCantidad = data.minimoCantidad ? data.minimoCantidad : undefined;
      let productId = data.productId ? new mongoose.Types.ObjectId(data.productId) : undefined;
      let groupId = data.groupId ? new mongoose.Types.ObjectId(data.groupId) : undefined;

      if (!minimoCompra && !minimoCantidad) {
        throw new Error('Debe especificar minimoCompra o minimoCantidad');
      }

      if (!productId && !groupId) {
        throw new Error('Debe especificar el producto o el grupo');
      }
      
      const descuentoExists = await this.repository.findByName(data.nombre!);

      if (descuentoExists) {
        await this.updateDescuento((descuentoExists._id as Types.ObjectId).toString(), data);

        let response = {
          tipoDescuentoEntidad: data.tipoDescuentoEntidad!,
          productId: data.productId,
          groupId: data.groupId,
          tipoDescuento: descuentoExists.tipoDescuento,
          _id:descuentoExists.id,
          activo: descuentoExists.activo,
          minimoCantidad: descuentoExists.minimoCantidad,
          minimoCompra: descuentoExists.minimoCompra,
          moneda_id: descuentoExists.moneda_id,
          nombre: descuentoExists.nombre,
          valorDescuento: descuentoExists.valorDescuento,
          fechaInicio: descuentoExists.fechaInicio,
          fechaFin: descuentoExists.fechaFin,
          codigoDescunto: descuentoExists.codigoDescunto,
          deleted_at: descuentoExists.deleted_at,
          minimiType: descuentoExists.minimiType
        } as IDescuentoCreateResponse;

        return response
      }

      const newDescuento = await this.repository.create(data)

      let response = {
        tipoDescuentoEntidad: data.tipoDescuentoEntidad!,
        productId: data.productId,
        groupId: data.groupId,
        tipoDescuento: newDescuento.tipoDescuento,
        _id:newDescuento.id,
        activo: newDescuento.activo,
        minimoCantidad: newDescuento.minimoCantidad,
        minimoCompra: newDescuento.minimoCompra,
        moneda_id: newDescuento.moneda_id,
        nombre: newDescuento.nombre,
        valorDescuento: newDescuento.valorDescuento,
        fechaInicio: newDescuento.fechaInicio,
        fechaFin: newDescuento.fechaFin,
        codigoDescunto: newDescuento.codigoDescunto,
        deleted_at: newDescuento.deleted_at,
        minimiType: newDescuento.minimiType
      } as IDescuentoCreateResponse;

      let tipoDescuentoEntidad = data.tipoDescuentoEntidad!;
     
      let descuentoId = newDescuento._id as mongoose.Types.ObjectId;
      let sucursalId = data.sucursalId ? new mongoose.Types.ObjectId(data.sucursalId) : undefined;  

      if (tipoDescuentoEntidad === 'Product') {
        let descuentoProducto = {
          descuentoId,
          productId,
          sucursalId,
        };

        await this.repository.createDescuentoProducto(
          descuentoProducto,
          
        );
      } else if (tipoDescuentoEntidad === 'Group') {
        let descuentoGrupo = {
          descuentoId,
          grupoId: groupId,
          sucursalId,
        };

        await this.repository.createDescuentoGrupo(descuentoGrupo);
      }
      
      return response;
    } catch (error) {
      console.log(error);
      throw new Error(error.message);
    }
  }

  async getDescuentoById(id: string): Promise<IDescuento | null> {
    const descuento = await this.repository.findById(id);
    if (!descuento) {
      throw new Error('Grupo not found');
    }
    return descuento;
  }

  async getAllDescuentos(): Promise<IDescuento[]> {
    return this.repository.findAll();
  }

  async getDescuentoBySucursalId(sucursalId: string): Promise<IListDescuentoResponse> {
    return this.repository.findBySucursalId(sucursalId);
  }

  async updateDescuento(
    id: string,
    data: Partial<IDescuento>
  ): Promise<IDescuento | null> {
    const descuento = await this.repository.update(id, data);
    if (!descuento) {
      throw new Error('Grupo not found');
    }
    return descuento;
  }

  async deleteDescuento({ id, sucursalId, productoId, grupoId }:IDescuentoDeleteParams) {
    let idMongoose = new Types.ObjectId(id);
    let sucursalIdMongoose = new Types.ObjectId(sucursalId)
    let grupoIdMongoose = new Types.ObjectId(grupoId)
    let productIdMongoose = new Types.ObjectId(productoId)

    if (grupoId) {
      if (sucursalId) {
        return await this.repository.deleteGroupBySucursal(idMongoose, grupoIdMongoose, sucursalIdMongoose)
      } else {
        return await this.repository.deleteGroupGeneral(idMongoose, grupoIdMongoose)
      }
    }

    if (productoId) {
      if (sucursalId) {
        return await this.repository.deleteProductBySucursal(idMongoose, productIdMongoose, sucursalIdMongoose)
      } else {
        return await this.repository.deleteProductGeneral(idMongoose, productIdMongoose)
      }
    }

    return null;
  }

  async restoreDescuento(id: string): Promise<IDescuento | null> {
    return this.repository.restore(id);
  }

  async findDescuentosAplicadosByDTId(detalleVentaIds: Types.ObjectId[]): Promise<ITransaccionDescuentosAplicados[]> {
    let descuentoAplicados = await this.repository.findDescuentosAplicadosByDTId(detalleVentaIds);

    return descuentoAplicados;
  }
}
