import { CustomError } from "./CustomError";

export class ForbiddenError extends CustomError {
  statusCode = 403;

  constructor(public message: string = 'Acceso denegado') {
    super(message);
  }

  serializeErrors() {
    return [{ message: this.message }];
  }
}