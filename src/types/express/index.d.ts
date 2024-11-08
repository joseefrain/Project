declare namespace Express {
  interface Request {
    user?: import('../../utils/jwt').CustomJwtPayload;
  }
}
