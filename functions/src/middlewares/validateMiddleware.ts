import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { IError } from '../interface/gen';
import { ROL } from '../models/usuarios/User.model';
import { formaterInManageTimezone, getDateInManaguaTimezone, useTodayDateRange } from '../utils/date';
import { DailyRegisterModel } from '../models/usuarios/DailyRegister.model';

export const validateMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        if (decoded.rol !== ROL.ROOT) {
          const [startDateISO, endDateISO] = useTodayDateRange();

          const register = await DailyRegisterModel.findOne({
            userId: decoded.id,
            date: {
              $gte: formaterInManageTimezone(new Date(startDateISO)),
              $lte: formaterInManageTimezone(new Date(endDateISO)),
            },
            hourExit: null,
            deleted_at: null,
          });

          if (register) {

            let endWordUTC = new Date(register?.endWork!);
            const endWork = formaterInManageTimezone(new Date(endWordUTC.setHours(endWordUTC.getHours() + 6)));

            if (endWork < getDateInManaguaTimezone()) {
              throw new Error('No se puede acceder a la plataforma porque ya se ha cerrado la hora de trabajo');
            }
          }
        }
      }
    }

    next();
  } catch (error) {
    return res.status(500).json({
      message: 'An error occurred during token validation',
      error: (error as IError).message,
    });
  }
};
