import { injectable, inject } from 'tsyringe';
import {
  IProducto,
  IProductCreate,
  IBranchProductsAll,
  IProductShortage,
  IProductInTransit,
} from '../../models/inventario/Producto.model';
import { ProductoRepository } from '../../repositories/inventary/Producto.repository';
import { TrasladoRepository } from '../../repositories/traslado/traslado.repository';
import mongoose from 'mongoose';
import { IDetalleTraslado } from '../../models/traslados/DetalleTraslado.model';
import { InventarioSucursalRepository } from '../../repositories/inventary/inventarioSucursal.repository';
import { IInventarioSucursal } from '../../models/inventario/InventarioSucursal.model';
import { ITraslado } from '../../models/traslados/Traslado.model';
import { ISucursal } from '../../models/sucursales/Sucursal.model';
import { IProductosGrupos } from '../../models/inventario/ProductosGrupo.model';
import { CustomJwtPayload } from '../../utils/jwt';

@injectable()
export class ProductoService {
  constructor(
    @inject(ProductoRepository) private repository: ProductoRepository,
    @inject(TrasladoRepository) private trasladoRepository: TrasladoRepository,
    @inject(InventarioSucursalRepository)
    private inventarioSucursalRepository: InventarioSucursalRepository
  ) {}

  async createProduct(
    data: Partial<IProductCreate>,
    user: CustomJwtPayload
  ): Promise<IProductCreate | IProducto> {

    let isGeneralProduct = user.role === 'root' ? (data.sucursalId! ? false : true) : false;

    if (isGeneralProduct) {
      return (await this.repository.createGeneralProducts(data) as IProducto);
    } else {
      return (await this.repository.create(data) as IProductCreate);
    }
  }

  async getProductById(id: string): Promise<IProducto | null> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new Error('Product not found');
    }
    return user;
  }

  async getAllProduct(
    filters: any,
    limit: number,
    skip: number
  ): Promise<IProducto[]> {
    return this.repository.findAll(
      { ...filters, deleted_at: null },
      limit,
      skip
    );
  }

  async updateProduct(
    id: string,
    data: Partial<IProducto>
  ): Promise<IProducto | null> {
    const branch = await this.repository.update(id, data);
    if (!branch) {
      throw new Error('Product not found');
    }
    return branch;
  }

  async deleteProduct(id: string): Promise<IProducto | null> {
    const branch = await this.repository.delete(id);
    if (!branch) {
      throw new Error('Product not found');
    }
    return branch;
  }

  async restoreProduct(id: string): Promise<IProducto | null> {
    return this.repository.restore(id);
  }


  async findProductInTransitBySucursal(
    sucursaleId: string
  ): Promise<IProductInTransit[]> {
    const pedidosEnTransito = await this.trasladoRepository.findAllPedidoBySucursal(sucursaleId);
  
    const pedidoIds = (pedidosEnTransito.map((pedido) => pedido._id) as string[]);
  
    const itemsDePedido = await this.trasladoRepository.findAllItemsDePedidosByPedidosInTransit(pedidoIds);
  
    const listInventarioSucursalId = ([...new Set(itemsDePedido.map((item) => item.inventarioSucursalId.toString()))] as string[]);
  
    const productos = await this.inventarioSucursalRepository.getListProductByInventarioSucursalIds(
      sucursaleId,
      listInventarioSucursalId
    );
  
    const productoMap = new Map(productos.map((prod) => [prod.id.toString(), prod]));
    const pedidoMap = new Map(pedidosEnTransito.map((pedido:ITraslado) => [(pedido._id as mongoose.Types.ObjectId).toString(), pedido]));
  
    const productInTransit = itemsDePedido.map((element) => {
      const inventarioSucursal = productoMap.get(element.inventarioSucursalId.toString()) as IInventarioSucursal;
      const pedido = pedidoMap.get(element.trasladoId.toString()) as ITraslado;
      const producto = inventarioSucursal?.productoId as IProducto;
      const sucursalDestino = pedido?.sucursalDestinoId as ISucursal;
  
      return inventarioSucursal && pedido
        ? {
            nombre: producto.nombre,
            descripcion: producto.descripcion,
            ultimoMovimiento: inventarioSucursal.ultimo_movimiento,
            stock: element.cantidad,
            precio: inventarioSucursal.precio,
            monedaId: producto.monedaId,
            consucutivoPedido: pedido.nombre,
            id: element._id,
            sucursalDestino: sucursalDestino.nombre,
          }
        : null;
    }).filter((item) => item !== null) as IProductInTransit[];
  
    return productInTransit;
  }
  

  async findAllProducts(): Promise<IBranchProductsAll[]> {
    return this.repository.findAllProducts();
  }
  async findProductoGrupoByProductId(
    productId: string
  ): Promise<IProductosGrupos | null> {
    return this.repository.findProductoGrupoByProductId(productId);
  }

  async restoreAll(): Promise<void> {
    return this.repository.removeDuplicateInventario();
  }

  async findRepeatedProductsInInventario(): Promise<any[]> {
    return this.repository.findRepeatedProductsInInventario();
  }
}
