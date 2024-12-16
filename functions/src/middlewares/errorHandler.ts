// middlewares/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../errors/CustomError';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof CustomError) {
    return res.status(err.statusCode).json({ errors: err.serializeErrors() });
  }

  // Manejo de errores genéricos que no están definidos como CustomError
  switch (err.name) {
    case 'CastError':
      return res.status(400).json({ errors: [{ message: 'ID mal formado' }] });
    case 'ValidationError':
      return res.status(400).json({ errors: [{ message: 'Error de validación', details: err.message }] });
    case 'ReferenceError':
      return res.status(500).json({ errors: [{ message: 'Error interno de referencia', details: err.message }] });
    case 'TypeError':
      return res.status(500).json({ errors: [{ message: 'Error de tipo', details: err.message }] });
    case 'SyntaxError':
      return res.status(400).json({ errors: [{ message: 'Error de sintaxis en la solicitud', details: err.message }] });
    case 'MongoError':
      return res.status(500).json({ errors: [{ message: 'Error en la base de datos', details: err.message }] });
    default:
      console.error('Error inesperado:', err);
      return res.status(500).json({ errors: [{ message: err.message }] });
  }
};
