import { CustomError } from "./CustomError";

export class DatabaseError extends CustomError {
  statusCode = 500;

  constructor(public message: string = 'Error de base de datos') {
    super(message);
  }

  serializeErrors() {
    return [{ message: this.message }];
  }
}