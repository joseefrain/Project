import { injectable } from 'tsyringe';
import {
  IBranchProducts,
  IProducto,
  IProductShortage,
  Producto,
} from '../../models/inventario/Producto.model';
import { Sucursal, ISucursal } from '../../models/sucursales/Sucursal.model';
import { IInventarioSucursal, InventarioSucursal } from '../../models/inventario/InventarioSucursal.model';
import mongoose from 'mongoose';
import { IProductosGrupos, ProductosGrupos } from '../../models/inventario/ProductosGrupo.model';
import { IGrupoInventario } from '../../models/inventario/GrupoInventario.model';
import { IUser, User } from '../../models/usuarios/User.model';

@injectable()
export class SucursalRepository {
  private model: typeof Producto;
  private modelSucursal: typeof Sucursal;
  private modelUser: typeof User;
  private modelInventarioSucursal: typeof InventarioSucursal;
  private modelProductosGrupos: typeof ProductosGrupos;

  constructor() {
    this.model = Producto;
    this.modelSucursal = Sucursal;
    this.modelInventarioSucursal = InventarioSucursal;
    this.modelProductosGrupos = ProductosGrupos;
    this.modelUser = User;
  }

  async create(data: Partial<ISucursal>): Promise<ISucursal> {
    const sucursal = new this.modelSucursal(data);
    return await sucursal.save();
  }

  async findById(id: string): Promise<ISucursal | null> {
    const sucursal = await this.modelSucursal.findById(id);

    if (!sucursal) {
      return null;
    }

    return sucursal;
  }

  async findAll(
    filters: any = {},
    limit: number = 10,
    skip: number = 0
  ): Promise<ISucursal[]> {
    const query = this.modelSucursal.find({ ...filters, deleted_at: null });

    return await query.limit(limit).skip(skip).exec();
  }

  async findBranchProducts(id: string): Promise<IBranchProducts[]> {
    const sucursal = await this.modelSucursal.findById(id);

    if (!sucursal) {
      return [];
    }

    const products = await this.modelInventarioSucursal
      .find({ sucursalId: id, deleted_at: null })
      .populate(['productoId', 'sucursalId']);
      

    let newProducts: IBranchProducts[] = [];

    products.forEach((inventarioSucursal) => {
      if (inventarioSucursal.deleted_at == null) {
        let producto = inventarioSucursal.productoId as IProducto;
        let sucursalId = inventarioSucursal.sucursalId as ISucursal;

        if (producto.deleted_at == null) {
          newProducts.push({
            stock: inventarioSucursal.stock,
            nombre: producto.nombre,
            descripcion: producto.descripcion,
            precio: inventarioSucursal.precio,
            monedaId: producto.monedaId,
            deleted_at: producto.deleted_at,
            id: producto._id as mongoose.Types.ObjectId,
            sucursalId: sucursalId._id as mongoose.Types.ObjectId,
            inventarioSucursalId: inventarioSucursal._id as mongoose.Types.ObjectId,
            create_at: producto.create_at!,
            update_at: producto.update_at!,
            puntoReCompra: inventarioSucursal.puntoReCompra,
          });
        }
      }
    });

    return newProducts;
  }

  async findByName(name: string): Promise<ISucursal | null> {
    const query = this.modelSucursal.findOne({ nombre: name });

    return await query.exec();
  }

  async update(
    id: string,
    data: Partial<ISucursal>
  ): Promise<ISucursal | null> {
    return await this.modelSucursal
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
  }

  async delete(id: string): Promise<ISucursal | null> {
    return await this.modelSucursal
      .findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true })
      .exec();
  }

  async restore(id: string): Promise<ISucursal | null> {
    return await this.modelSucursal
    .findByIdAndUpdate(id, { deleted_at: null }, { new: true })
      .exec();
  }

  async searchForStockProductsAtBranch(branchId: string): Promise<IInventarioSucursal[]> {
    const products = await this.modelInventarioSucursal
      .find({ deleted_at: null, sucursalId: branchId })
      .populate([{ path: 'productoId' }, { path: 'sucursalId' }]);
  
    const idsToFind = products.map(element => element.productoId._id);
  
    let listProductSinSucursal: IInventarioSucursal[] = [];
  
    if (idsToFind.length > 0) {
      listProductSinSucursal = await this.modelInventarioSucursal.find({
        deleted_at: null,
        productoId: { $nin: idsToFind }, // Excluir IDs en lugar de $ne
      }).populate(["productoId", "sucursalId"]);
    } else {
      listProductSinSucursal = await this.modelInventarioSucursal.find({
        deleted_at: null
      }).populate(["productoId", "sucursalId"]);
    }
  
    // Filtrar los duplicados de productoId
    const uniqueProductsMap = new Map<string, IInventarioSucursal>();
    for (const product of listProductSinSucursal) {
      const productId = (product.productoId._id as mongoose.Types.ObjectId).toString();
      if (!uniqueProductsMap.has(productId) && (product.productoId as IProducto).deleted_at == null) {
        uniqueProductsMap.set(productId, product);
      }
    }
  
    // Convertir el Map a un array
    return Array.from(uniqueProductsMap.values());
  }

  async findUserAdminForBranch(branchId: string): Promise<IUser | null> {
    const query = this.modelUser.findOne({ sucursalId: branchId, role: "admin" });

    return await query.exec();
  }
  
}
