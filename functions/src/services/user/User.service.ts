import { UserRepository } from '../../repositories/user/User.repository';
import { IResponseLogin, IUser } from '../../models/usuarios/User.model';
import { generateToken } from '../../utils/jwt';
import mongoose, { Types } from 'mongoose';
import { injectable, inject } from 'tsyringe';
import { RoleService } from '../security/RoleService';

@injectable()
export class UserService {
  constructor(@inject(UserRepository) private repository: UserRepository
, @inject(RoleService) private roleService: RoleService) {}

  async createUser(data: Partial<IUser>): Promise<IUser> {
    const userExists = await this.repository.findByUsername(data.username!);

    if (userExists) {
      throw new Error('User already exists');
    }

    const newUser = await this.repository.create(data);

    return newUser;
  }

  async loginUser(data: Partial<IUser>): Promise<IResponseLogin> {
    const user = await this.repository.findByUsername(data.username!);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (user.deleted_at !== null) {
      throw new Error('User deleted');
    }

    const isMatch = await user.comparePassword(data.password!);

    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const token = generateToken({
      id: user._id as Types.ObjectId,
      username: user.username,
      roles: user.roles as mongoose.Types.ObjectId[],
    });

    return { token, user };
  }

  async getUserById(id: string): Promise<IUser | null> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async getAllUsers(
    filters: any,
    limit: number,
    skip: number
  ): Promise<IUser[]> {
    return this.repository.findAll(filters, limit, skip);
  }

  async updateUser(id: string, data: Partial<IUser>): Promise<IUser | null> {

    const user = await this.repository.update(id, data);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async deleteUser(id: string): Promise<IUser | null> {
    const user = await this.repository.delete(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async restoreUser(id: string): Promise<IUser | null> {
    return this.repository.restore(id);
  }

  async getAdminUserOrRootInSucursal(id: string): Promise<IUser | null> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }
}
