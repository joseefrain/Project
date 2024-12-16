import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { TrasladoService } from '../../services/traslado/traslado.service';
import { CustomJwtPayload } from '../../utils/jwt';

@injectable()
export class TrasladoController {
  constructor(@inject(TrasladoService) private service: TrasladoService) {}

  async postCreateEnvioProducto(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const traslado = await this.service.postCreateEnvioProducto(req.body, req.user as CustomJwtPayload);
      res.status(201).json(traslado);
    } catch (error) {
      next(error);
    }
  }

  async postCreateRecibirProducto(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const traslado = await this.service.postRecibirPedido(req.body);
      res.status(201).json(traslado);
    } catch (error) {
      next(error);
    }
  }

  async findPedidoEnviadosBySucursal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {

      const traslado = await this.service.findPedidoEnviadosBySucursal(req.params.id);
      res.status(201).json(traslado);

    } catch (error) {
      next(error);
    }
  }

  async findPedidoRecibidosBySucursal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const traslado = await this.service.findPedidoRecibidosBySucursal(
        req.params.id
      );
      res.status(201).json(traslado);
    } catch (error) {
      next(error);
    }
  }

  async findPedidoPorRecibirBySucursal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const traslado = await this.service.findPedidoPorRecibirBySucursal(
        req.params.id
      );
      res.status(201).json(traslado);
    } catch (error) {
      next(error);
    }
  }

  async findPedidoByIdWithItemDePedido(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const traslado = await this.service.findPedidoById(req.params.id);
      const listItemDePedido = await this.service.findAllItemDePedidoByPedidoDto(
        req.params.id
      );

      let pedido = {
        traslado,
        listItemDePedido: listItemDePedido,
      };

      res.status(201).json(pedido);
    } catch (error) {
      next(error);
    }
  }

  async returnProductToBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const traslado = await this.service.returnProductToBranch(req.params.id, req);
      res.status(201).json(traslado);
    } catch (error) {
      next(error);
    }
  }

  // async findPedidoPorSucursal(req: Request, res: Response, next: NextFunction): Promise<void> {
  //   try {
  //     const traslado = await this.service.findPedidoPorSucursal(req.body);
  //     res.status(201).json(traslado);
  //   } catch (error) {
  //     next(error);
  //   }
  // }
}
