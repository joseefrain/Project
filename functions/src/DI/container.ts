import { container } from 'tsyringe';
import { DailyRegisterRepository } from '../repositories/user/DailyRegister.repository';
import { DailyRegisterService } from '../services/user/DailyRegister.service';
import { DailyRegisterController } from '../controllers/usuarios/DailyRegister.controller';
import { DailyRegisterRouter } from '../routes/DailyRegister.router';


// Registrar implementaciones
container.register('IDailyRegisterRepository', {
  useClass: DailyRegisterRepository
});

container.register(DailyRegisterService, {
  useClass: DailyRegisterService
});

container.register(DailyRegisterController, {
  useClass: DailyRegisterController
});

container.register(DailyRegisterRouter, {
  useClass: DailyRegisterRouter
});

export { container };