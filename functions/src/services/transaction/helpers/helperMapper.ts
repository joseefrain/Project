import { cero128, compareToCero, formatObejectId } from '../../../gen/handleDecimal128';
import { IDetalleTransaccion } from '../../../models/transaction/DetailTransaction.model';
import {
  IDescuentoAplicado,
  ITransaccion,
  ITransaccionResponse,
  ITrasaccionProductoResponse,
  TypePaymentMethod,
  TypeTransaction,
} from '../../../models/transaction/Transaction.model';
import { inject, injectable } from 'tsyringe';
import { TransactionRepository } from '../../../repositories/transaction/transaction.repository';
import { IDescuento } from '../../../models/transaction/Descuento.model';
import { IProducto } from '../../../models/inventario/Producto.model';
import { Types } from 'mongoose';
import { IDescuentosProductos } from '../../../models/transaction/DescuentosProductos.model';
import { IDescuentoGrupo } from '../../../models/transaction/DescuentoGrupo.model';
import { IUser } from '../../../models/usuarios/User.model';

@injectable()
export class HelperMapperTransaction {
  constructor(@inject(TransactionRepository) private repository: TransactionRepository) {}

  async mapperData(venta: ITransaccion, detalleVenta: IDetalleTransaccion[]): Promise<ITransaccionResponse> {
    let products: ITrasaccionProductoResponse[] = [];

    for await (const detalle of detalleVenta) {
      let descuento: IDescuentoAplicado | null = null;

      if (!compareToCero(detalle.descuento)) {
        let descuentoAplicado = await this.repository.findVentaDescuentosAplicadosByDetalleVentaId(
          formatObejectId(detalle._id).toString()
        );

        if (descuentoAplicado) {
          let tipoAplicacion = descuentoAplicado.tipoAplicacion;
          let descuentoProducto = descuentoAplicado.descuentosProductosId as IDescuentosProductos;
          let descuentogrupo = descuentoAplicado.descuentoGrupoId as IDescuentoGrupo;
          let descuentoTipo = descuentoProducto ? descuentoProducto : descuentogrupo;
          let descuentoId = (descuentoTipo as IDescuentosProductos).descuentoId as IDescuento;

          let productId = descuentoProducto ? descuentoProducto.productId.toString() : null;
          let groupId = descuentogrupo ? descuentogrupo.grupoId.toString() : null;

          let sucursalId = descuentoProducto
            ? descuentoProducto?.sucursalId ? formatObejectId(descuentoProducto?.sucursalId)?.toString() : null
            : descuentogrupo?.sucursalId ? formatObejectId(descuentogrupo?.sucursalId)?.toString() : null;

          descuento = {
            id: formatObejectId(descuentoId._id).toString(),
            name: descuentoId.nombre,
            amount: Number(descuentoAplicado.monto),
            percentage: Number(descuentoAplicado.valor),
            type: tipoAplicacion === 'Product' ? 'producto' : 'grupo',
            productId: productId,
            groupId: groupId,
            sucursalId: sucursalId || null,
            fechaInicio: descuentoId.fechaInicio,
            fechaFin: descuentoId.fechaFin,
            minimoCompra: descuentoId.minimoCompra,
            minimoCantidad: descuentoId.minimoCantidad,
            activo: descuentoId.activo,
            minimiType: descuentoId.minimiType,
            tipoDescuento: descuentoId.tipoDescuento,
          };
        }
      }

      let productoDetalle = detalle.productoId as IProducto;

      let producto: ITrasaccionProductoResponse = {
        productId: formatObejectId(productoDetalle._id).toString(),
        clientType: detalle.tipoCliente,
        productName: (detalle.productoId as IProducto).nombre,
        quantity: detalle.cantidad,
        price: Number(detalle.precio),
        ventaId: formatObejectId(venta._id).toString(),
        inventarioSucursalId: '',
        groupId: '',
        discount: descuento,
        costoUnitario: 0,
        ajusteACobrar: cero128,
      };

      products.push(producto);
    }

    let user = venta.usuarioId as IUser;

    let ventaDto: ITransaccionResponse = {
      userId: (user._id as Types.ObjectId).toString(),
      sucursalId: venta.sucursalId.toString(),
      subtotal: Number(venta.subtotal),
      total: Number(venta.total),
      discount: Number(venta.descuento),
      fechaRegistro: venta.fechaRegistro,
      products: products,
      paymentMethod: venta.paymentMethod,
      tipoTransaccion: venta.tipoTransaccion,
      id: formatObejectId(venta._id).toString(),
      tipoTransaccionOrigen: venta.tipoTransaccion,
      totalAjusteACobrar: venta.totalAjusteACobrar,
      username: user.username,
    };

    return ventaDto;
  }

  async mapperDataAll(ventas: ITransaccion[]): Promise<ITransaccionResponse[]> {
    const results = await Promise.all(
      ventas.map((venta) => this.mapperData(venta, venta.transactionDetails as IDetalleTransaccion[]))
    );

    return results;
  }

  async mapperDataReturn(
    venta: Partial<ITransaccion>,
    detalleVenta: IDetalleTransaccion[]
  ): Promise<ITransaccionResponse> {
    let products: ITrasaccionProductoResponse[] = [];

    for await (const detalle of detalleVenta) {
      let descuento: IDescuentoAplicado | null = null;

      let productoDetalle = detalle.productoId as IProducto;

      let producto: ITrasaccionProductoResponse = {
        productId: formatObejectId(productoDetalle._id).toString(),
        clientType: detalle.tipoCliente,
        productName: productoDetalle.nombre,
        quantity: detalle.cantidad,
        price: Number(detalle.precio),
        ventaId: formatObejectId(venta._id).toString(),
        inventarioSucursalId: '',
        groupId: '',
        discount: descuento,
        costoUnitario: 0,
        ajusteACobrar: detalle.ajusteACobrar,
      };

      products.push(producto);
    }

    let tipoTransaccionOrigen = (
      venta.transaccionOrigenId ? (venta.transaccionOrigenId as ITransaccion).tipoTransaccion : null
    ) as TypeTransaction;
    let user = venta.usuarioId as IUser;

    let ventaDto: ITransaccionResponse = {
      userId: (user._id as Types.ObjectId).toString(),
      sucursalId: venta?.sucursalId?.toString() as string,
      subtotal: Number(venta.subtotal),
      total: Number(venta.total),
      discount: Number(venta.descuento),
      fechaRegistro: venta.fechaRegistro,
      products: products,
      paymentMethod: venta?.paymentMethod as TypePaymentMethod,
      tipoTransaccion: venta.tipoTransaccion as TypeTransaction,
      id: formatObejectId(venta._id).toString(),
      tipoTransaccionOrigen,
      totalAjusteACobrar: venta?.totalAjusteACobrar as Types.Decimal128,
      username: user.username,
    };

    return ventaDto;
  }
}
