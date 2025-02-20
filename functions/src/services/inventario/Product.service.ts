import { injectable, inject } from 'tsyringe';
import {
  IProducto,
  IProductCreate,
  IBranchProductsAll,
  IProductInTransit,
} from '../../models/inventario/Producto.model';
import { ProductoRepository } from '../../repositories/inventary/Producto.repository';
import { TrasladoRepository } from '../../repositories/traslado/traslado.repository';
import mongoose from 'mongoose';
import { InventarioSucursalRepository } from '../../repositories/inventary/inventarioSucursal.repository';
import { IInventarioSucursal, IInventarioSucursalUpdate } from '../../models/inventario/InventarioSucursal.model';
import { EstatusPedido, ITraslado } from '../../models/traslados/Traslado.model';
import { ISucursal } from '../../models/sucursales/Sucursal.model';
import { IProductosGrupos } from '../../models/inventario/ProductosGrupo.model';
import { CustomJwtPayload } from '../../utils/jwt';
import { RoleRepository } from '../../repositories/security/RoleRepository';
import { TransactionRepository } from '../../repositories/transaction/transaction.repository';
import { TypeEstatusTransaction } from '../../interface/ICaja';

@injectable()
export class ProductoService {
  constructor(
    @inject(ProductoRepository) private repository: ProductoRepository,
    @inject(TrasladoRepository) private trasladoRepository: TrasladoRepository,
    @inject(RoleRepository) private roleRepository: RoleRepository,
    @inject(InventarioSucursalRepository) private inventarioSucursalRepository: InventarioSucursalRepository,
    @inject(TransactionRepository) private transactionRepository: TransactionRepository
  ) {}

  async createProduct(
    data: Partial<IProductCreate>,
    user: CustomJwtPayload
  ): Promise<IProductCreate | IProducto> {

    return (await this.repository.create(data) as IProductCreate);
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
    data: Partial<IInventarioSucursalUpdate>
  ): Promise<Partial<IInventarioSucursalUpdate> | null> {
    let product = (await this.inventarioSucursalRepository.findById(id) as IInventarioSucursal);

    if (!product) {
      throw new Error('Product not found');
    }

    const productGeneral = await this.repository.findById(product.productoId.toString());

    if (!productGeneral) {
      throw new Error('Product not found');
    }

    productGeneral.nombre = data?.nombre ?  data?.nombre : productGeneral.nombre;
    productGeneral.descripcion = data?.descripcion ? data?.descripcion : productGeneral.descripcion;
    productGeneral.barCode = data?.barCode ? data?.barCode : productGeneral.barCode;

    if (data?.nombre || data?.descripcion) {
      productGeneral.save();
    }

    product.stock = data.stock as number;
    product.precio = data.precio as mongoose.Types.Decimal128;
    product.puntoReCompra = data.puntoReCompra as number;
    product.costoUnitario = data.costoUnitario as mongoose.Types.Decimal128;

    const branch = await this.inventarioSucursalRepository.update(id, data);

    if (!branch) {
      throw new Error('Product not found');
    }

    return {...branch.toJSON(), nombre: productGeneral.nombre, descripcion: productGeneral.descripcion};
  }

  async deleteProduct(id: string ): Promise<IInventarioSucursal | null> {

    let product = await this.inventarioSucursalRepository.findById(id);

    if (!product) {
      throw new Error('Producto no encontrado en inventario');
    }

    let isProductUsed = await this.verifyUseProduct(product.productoId.toString(), id);

    if (isProductUsed) {
      throw new Error('El producto no se puede eliminar porque está en uso');
    }

    await this.inventarioSucursalRepository.delete(id);
   
    return product;
  }

  async verifyUseProduct (productId:string, inventarioSucursalId:string): Promise<boolean> {
    try {
        
      let existeTransaction = await this.transactionRepository.findTransactionsByProductId(productId, TypeEstatusTransaction.PENDIENTE);
      let existTraslados = await this.trasladoRepository.findTrasladosByProductId(inventarioSucursalId, EstatusPedido.EnProceso);

      return existeTransaction.length > 0 || existTraslados.length > 0;
    } catch (error) {
      throw new Error("Error al verificar si el producto esta en uso");
    }
  };

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
