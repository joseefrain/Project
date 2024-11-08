import { injectable } from 'tsyringe';
import { ProductosGrupos } from '../../models/inventario/ProductosGrupo.model';
import { IProducto, Producto } from '../../models/inventario/Producto.model';
import {
  GrupoInventario,
  IGrupoInventario,
  IGrupoInventarioWithPopulate,
} from '../../models/inventario/GrupoInventario.model';
import mongoose from 'mongoose';

@injectable()
export class GrupoInventarioRepository {
  private model: typeof GrupoInventario;
  private modelProductoGrupo: typeof ProductosGrupos;
  private modelProducto: typeof Producto;

  constructor() {
    this.model = GrupoInventario;
    this.modelProductoGrupo = ProductosGrupos;
    this.modelProducto = Producto;
  }

  async create(data: Partial<IGrupoInventario>): Promise<IGrupoInventario> {
    const grupo = new this.model(data);
    return await grupo.save();
  }

  async findById(id: string): Promise<IGrupoInventario | null> {
    const grupo = await this.model.findById(id);

    if (!grupo) {
      return null;
    }

    return grupo;
  }
  async findByIdWithProduct(id: string): Promise<IGrupoInventarioWithPopulate | null> {
    const grupo = await this.model.findById(id);

    if (!grupo) {
      return null;
    }

    let newGrupo: IGrupoInventarioWithPopulate = {
      nombre: grupo.nombre,
      descripcion: grupo.descripcion,
      _id: (grupo._id as mongoose.Types.ObjectId),
      deleted_at: grupo.deleted_at,
      products: [],
    };

    let productGroup = await this.modelProductoGrupo
      .find({ grupoId: id, deleted_at: null })
      .populate('productoId');

    if (productGroup.length > 0) {
      productGroup.forEach((product) => {
        if ((product.productoId as IProducto).deleted_at == null) {
          newGrupo.products.push(product.productoId as IProducto);
        }
      });
    }

    return newGrupo;
  }

  async findByIdWithProductBySucursalId(id: string, sucursalId: string): Promise<IGrupoInventarioWithPopulate | null> {
    const grupo = await this.model.findById(id);

    if (!grupo) {
      return null;
    }

    let newGrupo: IGrupoInventarioWithPopulate = {
      nombre: grupo.nombre,
      descripcion: grupo.descripcion,
      _id: (grupo._id as mongoose.Types.ObjectId),
      deleted_at: grupo.deleted_at,
      products: [],
    };

    let productGroup = await this.modelProductoGrupo
      .find({ grupoId: id, deleted_at: null })
      .populate('productoId');

    let productGroupGen = productGroup.filter((product) => product.sucursalId === undefined);
    let productGroupSuc = productGroup.filter((product) => (product.sucursalId as mongoose.Types.ObjectId).toString() === sucursalId);

    if (productGroupGen.length > 0) {
      productGroupGen.forEach((product) => {
        if ((product.productoId as IProducto).deleted_at == null) {
          newGrupo.products.push(product.productoId as IProducto);
        }
      });
    }

    if (productGroupSuc.length > 0) {
      productGroupSuc.forEach((product) => {
        if ((product.productoId as IProducto).deleted_at == null) {
          newGrupo.products.push(product.productoId as IProducto);
        }
      });
    }

    return newGrupo;
  }

  async findAll(
    filters: any = {},
    limit: number = 10,
    skip: number = 0
  ): Promise<IGrupoInventario[]> {
    const query = this.model.find({ ...filters, deleted_at: null });

    return await query.limit(limit).skip(skip).exec();
  }

  async findByName(
    name: string,
  ): Promise<IGrupoInventario | null> {
    const grupo = await this.model.findOne({ nombre: name });

    return grupo;
  }

  async update(
    id: string,
    data: Partial<IGrupoInventario>
  ): Promise<IGrupoInventario | null> {
    return await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<IGrupoInventario | null> {
    return await this.model
      .findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true })
      .exec();
  }

  async restore(id: string): Promise<IGrupoInventario | null> {
    return await this.model
      .findByIdAndUpdate(id, { deleted_at: null }, { new: true })
      .exec();
  }
}
