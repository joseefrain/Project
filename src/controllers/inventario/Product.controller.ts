import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { ProductoService } from '../../services/inventario/Product.service';
import { sendChannelMessage } from '../../services/utils/slackService';
import { CustomJwtPayload } from '../../utils/jwt';

@injectable()
export class ProductoController {
  constructor(@inject(ProductoService) private service: ProductoService) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await this.service.createProduct(req.body, (req.user as CustomJwtPayload));
      res.status(201).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async getById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const branch = await this.service.getProductById(req.params.id);
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 10, skip = 0, ...filters } = req.query;
      const branch = await this.service.getAllProduct(
        filters,
        Number(limit),
        Number(skip)
      );
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await this.service.updateProduct(req.params.id, req.body);
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await this.service.deleteProduct(req.params.id);
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async restore(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const branch = await this.service.restoreProduct(req.params.id);
      res.status(200).json(branch);
    } catch (error) {
      next(error);
    }
  }

  async findProductInTransitBySucursal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {

      const product = await this.service.findProductInTransitBySucursal(req.params.id);
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  }
  async findAllProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await this.service.findAllProducts();
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  }
  async findProductoGrupoByProductId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await this.service.findProductoGrupoByProductId(req.params.id);
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  }
  async restoreAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.service.restoreAll();
      res.status(200).json({ "restored": true });
    } catch (error) {
      next(error);
    }
  }

  async findRepeatedProductsInInventario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const repeatedProducts = await this.service.findRepeatedProductsInInventario();
      res.status(200).json(repeatedProducts);
    } catch (error) {
      next(error);
    }
  }
}
