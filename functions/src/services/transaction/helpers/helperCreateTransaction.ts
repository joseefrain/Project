import { inject, injectable } from 'tsyringe';
import { TransactionRepository } from '../../../repositories/transaction/transaction.repository';
import { DescuentoRepository } from '../../../repositories/transaction/descuento.repository';
import { InventoryManagementService } from '../../traslado/InventoryManagement.service';
import { CashRegisterService } from '../../utils/cashRegister.service';
import { CreditoService } from '../../credito/Credito.service';
import { ResumenCajaDiarioRepository } from '../../../repositories/caja/DailyCashSummary.repository';
import { ITransaccion, ITransaccionCreate, TypeTransaction } from '../../../models/transaction/Transaction.model';
import { formatDecimal128, formatObejectId } from '../../../gen/handleDecimal128';
import { getDateInManaguaTimezone } from '../../../utils/date';
import { ITipoDescuentoEntidad } from '../../../models/transaction/Descuento.model';
import { ITipoDescuento } from '../../../models/transaction/TransactionDescuentosAplicados.model';
import { CustomJwtPayload } from '../../../utils/jwt';
import { IInventarioSucursal } from '../../../models/inventario/InventarioSucursal.model';
import { TipoMovimientoInventario } from '../../../interface/IInventario';
import { IProducto } from '../../../models/inventario/Producto.model';
import { notifyTelergramReorderThreshold } from '../../utils/telegramServices';
import { ISucursal } from '../../../models/sucursales/Sucursal.model';
import { ModalidadCredito, TypeCredito } from '../../../models/credito/Credito.model';
import { ITransactionCreateCaja } from '../../../interface/ICaja';

@injectable()
export class HelperCreateTransaction {
  constructor(
    @inject(TransactionRepository) private repository: TransactionRepository,
    @inject(InventoryManagementService)
    private inventoryManagementService: InventoryManagementService,
    @inject(DescuentoRepository)
    private descuentoRepository: DescuentoRepository,
    @inject(CashRegisterService)
    private cashRegisterService: CashRegisterService,
    @inject(CreditoService) private creditoService: CreditoService,
    @inject(ResumenCajaDiarioRepository)
    private resumenRepository: ResumenCajaDiarioRepository,
    @inject(CreditoService) private service: CreditoService
  ) {}

  async initInventory(venta: Partial<ITransaccionCreate>, userId: string) {
    const listInventarioSucursalIds = venta.products?.map((d) => d.inventarioSucursalId) || [];
    await this.inventoryManagementService.init({
      userId,
      branchId: venta.sucursalId!,
      listInventarioSucursalId: listInventarioSucursalIds,
    });
  }

  async createSale(venta: Partial<ITransaccionCreate>) {
    return this.repository.create({
      usuarioId: formatObejectId(venta.userId!),
      sucursalId: formatObejectId(venta.sucursalId!),
      subtotal: formatDecimal128(venta.subtotal!),
      total: formatDecimal128(venta.total!),
      descuento: formatDecimal128(venta.discount || '0'),
      fechaRegistro: getDateInManaguaTimezone(),
      tipoTransaccion: venta.tipoTransaccion,
      paymentMethod: venta.paymentMethod,
      entidadId: formatObejectId(venta.entidadId!),
      estadoTrasaccion: venta.paymentMethod === 'credit' ? 'PENDIENTE' : 'PAGADA',
      cajaId: formatObejectId(venta.cajaId!),
    });
  }

  async applyDiscounts(detalles: any[]) {
    await Promise.all(
      detalles.map(async ({ newDetalleVenta, item }) => {
        if (!item.discount) return;

        let tipoAplicacion: ITipoDescuentoEntidad = item.discount.type === 'grupo' ? 'Group' : 'Product';
        const descuentoId =
          tipoAplicacion === 'Product'
            ? formatObejectId((await this.descuentoRepository.getDescuentoProductoByDescuentoId(item.discount.id))?._id)
            : formatObejectId(
                (await this.descuentoRepository.getDescuentoGrupoByDescuentoId(item.discount.id))?.descuentoId
              );

        if (!descuentoId) return;

        const ventaDescuento = {
          detalleVentaId: formatObejectId(newDetalleVenta._id),
          descuentosProductosId: tipoAplicacion === 'Product' ? descuentoId : undefined,
          descuentoGrupoId: tipoAplicacion === 'Group' ? descuentoId : undefined,
          tipoAplicacion,
          valor: formatDecimal128(item.discount.percentage),
          tipo: ITipoDescuento.PORCENTAJE,
          monto: formatDecimal128(item.discount.amount),
        };

        await this.repository.createVentaDescuentosAplicados(ventaDescuento);
      })
    );
  }

  async handleInventory(newSale: ITransaccion, venta: Partial<ITransaccionCreate>, user: CustomJwtPayload) {
    const listInventarioSucursal: IInventarioSucursal[] = [];

    await Promise.all(
      venta.products!.map(async (item) => {
        const data = {
          inventarioSucursalId: formatObejectId(item.inventarioSucursalId),
          quantity: item.quantity,
          isNoSave: true,
          tipoMovimiento:
            newSale.tipoTransaccion === TypeTransaction.VENTA
              ? TipoMovimientoInventario.VENTA
              : TipoMovimientoInventario.COMPRA,
        };

        const inventarioSucursal =
          newSale.tipoTransaccion === 'VENTA'
            ? await this.inventoryManagementService.subtractQuantity(data)
            : await this.inventoryManagementService.addQuantity({
                ...data,
                cost: item.costoUnitario,
              });

        if (inventarioSucursal) {
          if (inventarioSucursal.stock <= inventarioSucursal.puntoReCompra) {
            listInventarioSucursal.push(inventarioSucursal);
          }
        }
      })
    );

    if (listInventarioSucursal.length > 0) {
      const productListReOrder = listInventarioSucursal.map((item) => ({
        name: (item.productoId as IProducto).nombre,
        currentQuantity: item.stock,
        reorderPoint: item.puntoReCompra,
      }));

      notifyTelergramReorderThreshold(
        user.username,
        (listInventarioSucursal[0].sucursalId as ISucursal).nombre,
        productListReOrder,
        user.chatId
      );
    }

    return listInventarioSucursal;
  }

  async handleTransactionDetails(newSale: ITransaccion, venta: Partial<ITransaccionCreate>) {
    const detalles = await Promise.all(
      venta.products!.map(async (item) => {
        let tipoAplicacion: ITipoDescuentoEntidad = item.discount?.type === 'grupo' ? 'Group' : 'Product';

        const detalleVenta = {
          ventaId: formatObejectId(newSale._id),
          productoId: formatObejectId(item.productId),
          precio: formatDecimal128(item.price),
          cantidad: item.quantity,
          subtotal: formatDecimal128(item.price * item.quantity),
          total: formatDecimal128(item.price * item.quantity - (item.discount?.amount || 0)),
          descuento: formatDecimal128(item.discount?.amount || 0),
          tipoCliente: item.clientType,
          tipoDescuentoEntidad: tipoAplicacion,
          deleted_at: null,
        };

        const newDetalleVenta = await this.repository.createDetalleVenta(detalleVenta);
        return { newDetalleVenta, item };
      })
    );

    // Asignar los detalles a la venta
    newSale.transactionDetails = detalles.map((d) => formatObejectId(d.newDetalleVenta._id));
    await newSale.save();

    // Manejar descuentos
    await this.applyDiscounts(detalles);
  }

  private async handleCredit(newSale: ITransaccion, venta: Partial<ITransaccionCreate>) {
    const credito = {
      sucursalId: formatObejectId(newSale.sucursalId),
      entidadId: formatObejectId(newSale.entidadId),
      transaccionId: formatObejectId(newSale._id),
      tipoCredito: newSale.tipoTransaccion === TypeTransaction.VENTA ? TypeCredito.VENTA : TypeCredito.COMPRA,
      modalidadCredito: venta.credito?.modalidadCredito as ModalidadCredito,
      saldoCredito: formatDecimal128(venta?.total),
      plazoCredito: venta.credito?.plazoCredito,
      cuotaMensual: formatDecimal128(venta.credito?.cuotaMensual),
      pagoMinimoMensual: formatDecimal128(venta.credito?.pagoMinimoMensual),
      fechaVencimiento: getDateInManaguaTimezone(),
    };

    await this.creditoService.createCredito(credito);
  }

  async updateCashRegisterAndSummary(newSale: ITransaccion, venta: Partial<ITransaccionCreate>) {
    await this.inventoryManagementService.updateAllBranchInventory();
    await this.inventoryManagementService.saveAllMovimientoInventario();
    await newSale.save();

    if (venta.paymentMethod === 'cash') {
      await this.cashRegisterService.actualizarMontoEsperadoByTrasaccion({
        data: {
          ...venta,
          id: formatObejectId(newSale._id),
        } as ITransactionCreateCaja,
      });
    }

    await this.resumenRepository.addTransactionDailySummary(newSale);

    if (newSale.paymentMethod === 'credit') {
      await this.handleCredit(newSale, venta);
    }
  }
}
