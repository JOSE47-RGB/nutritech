import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    const origins = (process.env.APP_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    // Cabecera no simple: un sitio ajeno necesita un preflight CORS, que no habilitamos.
    if (
      req.get('X-NutriTech-Request') !== '1' ||
      (req.get('Origin') && !origins.includes(req.get('Origin')!))
    ) {
      throw new ForbiddenException('Origen de solicitud no permitido.');
    }
    return true;
  }
}
