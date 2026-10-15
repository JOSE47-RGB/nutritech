import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from './permissions.service';
import { REQUIRED_PERMISSIONS } from './require-permissions.decorator';
import type { AuthRequest } from '../auth/auth.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndMerge<string[]>(REQUIRED_PERMISSIONS, [
        context.getClass(),
        context.getHandler(),
      ]) ?? [];
    if (!required.length) return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (!request.principal)
      throw new UnauthorizedException('Inicia sesión para continuar.');
    const effective = new Set(
      await this.permissions.forUser(request.principal.usuarioId),
    );
    if (!required.every((permission) => effective.has(permission))) {
      throw new ForbiddenException(
        'No tienes permiso para realizar esta acción.',
      );
    }
    return true;
  }
}
