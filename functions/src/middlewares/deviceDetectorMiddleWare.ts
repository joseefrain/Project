import { NextFunction, Request, Response } from 'express';

const UAParser = require('ua-parser-js');

export const deviceDetectorMiddleWare = (  req: Request,
  res: Response,
  next: NextFunction) => {
  const parser = new UAParser(req.headers['user-agent']);
  const deviceType = parser.getDevice().type || 'desktop';
  req.isMobile = deviceType === 'mobile' || deviceType === 'tablet';
  next();
}