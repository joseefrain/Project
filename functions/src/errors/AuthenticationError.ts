import { CustomError } from "./CustomError";

export class AuthenticationError extends CustomError {
  statusCode = 401;

  constructor(public message: string = 'No autorizado') {
    super(message);
  }

  serializeErrors() {
    return [{ message: this.message }];
  }
}