import { injectable, inject } from 'tsyringe';
import { IRole } from '../../models/security/Role.model';
import { RoleRepository } from '../../repositories/security/RoleRepository';
import { UserRepository } from '../../repositories/user/User.repository';
import mongoose, { DeleteResult, mongo, Types } from 'mongoose';
import { IUser } from '../../models/usuarios/User.model';
import {
  DEFAULT_ROLE_PAGES,
  NIVEL_PERMISO,
  NIVEL_PERMISO_ENUM,
  PAGES_MODULES,
} from '../../models/security/permissionLevels';

@injectable()
export class RoleService {
  constructor(
    @inject(RoleRepository) private repository: RoleRepository,
    @inject(UserRepository) private userRepository: UserRepository
  ) {}

  async createRole(data: Partial<IRole>): Promise<IRole | null> {
    const roleExists = await this.repository.findByName(data.name!);

    if (roleExists) {
      throw new Error('role already exists');
    }

    const newRole = await this.repository.create(data);

    return newRole;
  }

  async addSingleRoleToUser(
    userId: string,
    roleId: string
  ): Promise<IUser | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('user not found');
    }

    const role = await this.repository.findById(roleId);
    if (!role) {
      throw new Error('role not found');
    }

    (user.roles as mongoose.Types.ObjectId[]).push(
      role._id as mongoose.Types.ObjectId
    );

    return await this.userRepository.update(userId, user);
  }

  async addMultipleRolesToUser(
    userId: string,
    rolesId: string[]
  ): Promise<IUser | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('user not found');
    }

    const roles = await this.repository.findListByIds(rolesId);

    for (const role of roles) {
      if (!role) {
        throw new Error('role not found');
      }

      (user.roles as mongoose.Types.ObjectId[]).push(
        role._id as mongoose.Types.ObjectId
      );
    }

    return await this.userRepository.update(userId, user);
  }

  async getRoleById(id: string): Promise<IRole | null> {
    const role = await this.repository.findById(id);
    if (!role) {
      throw new Error('role not found');
    }
    return role;
  }

  async getAllRole(
    filters: any,
    limit: number,
    skip: number
  ): Promise<IRole[]> {
    return this.repository.findAll(filters, limit, skip);
  }

  async updateRole(id: string, data: Partial<IRole>): Promise<IRole | null> {
    const role = await this.repository.update(id, data);
    if (!role) {
      throw new Error('role not found');
    }
    return role;
  }

  async deleteRole(id: string): Promise<DeleteResult> {
    const isReferenced = await this.repository.isIdReferenced(id);

    if (isReferenced) {
      throw new Error('El rol no puede ser eliminado porque está en uso');
    }

    const role = await this.repository.delete(id);
    if (!role) {
      throw new Error('role not found');
    }
    
    return role;
  }

  async findListRoleByUser(roles: mongoose.Types.ObjectId[]): Promise<IRole[]> {
    let ids = (roles).map((role) => role.toString());
    return this.repository.findListByIds(ids);
  }


validateCombinedRolesAgainstDefaultPages = (roles: IRole[]): boolean => {
  // Crear un mapa combinado de módulos y niveles a partir de los roles del usuario
  const combinedPrivilegesMap: Record<string, Set<number>> = {};

  roles.forEach((role) => {
    role.privileges.forEach((privilege) => {
      const { module, levels } = privilege;

      // Inicializar el módulo en el mapa si no existe
      if (!combinedPrivilegesMap[module]) {
        combinedPrivilegesMap[module] = new Set();
      }

      // Agregar los niveles al módulo correspondiente
      levels.forEach((level) => combinedPrivilegesMap[module].add(level));
    });
  });

  // Validar que la combinación cumpla con DEFAULT_ROLE_PAGES
  for (const requiredPrivilege of DEFAULT_ROLE_PAGES) {
    const { module, levels: requiredLevels } = requiredPrivilege;

    // Si el módulo no está presente en los privilegios combinados, fallo
    if (!combinedPrivilegesMap[module]) {
      return false;
    }

    // Validar que todos los niveles requeridos estén presentes
    const moduleLevels = combinedPrivilegesMap[module];
    const hasAllRequiredLevels = requiredLevels.every((level) => moduleLevels.has(level));
    if (!hasAllRequiredLevels) {
      return false;
    }
  }

  return true; // Si pasa todas las validaciones, cumple con los privilegios requeridos
};


  async validateRootRole(user: Partial<IUser>): Promise<boolean> {
    // Obtener los IDs de los roles asociados al usuario
    const ids = (user.roles as mongoose.Types.ObjectId[]).map((role) => role.toString());
    const roles = await this.repository.findListByIds(ids);
  
    // Validar que la combinación de roles tenga todos los privilegios necesarios
    const isFullAccess = this.validateCombinedRolesAgainstDefaultPages(roles);
    return isFullAccess;
  }
}
