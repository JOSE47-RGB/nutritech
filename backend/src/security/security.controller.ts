import { Controller, Get, Header } from '@nestjs/common';
import { RequirePermissions } from '../permissions/require-permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('seguridad')
export class SecurityController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('roles')
  @RequirePermissions('roles.gestionar')
  @Header('Cache-Control', 'no-store')
  async roles() {
    const roles = await this.prisma.roles.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        descripcion: true,
        activo: true,
        rol_permiso: {
          where: { permisos: { activo: true } },
          select: {
            permisos: {
              select: { codigo: true, modulo: true, descripcion: true },
            },
          },
        },
      },
    });
    return roles.map(({ rol_permiso, ...role }) => ({
      ...role,
      permisos: rol_permiso
        .map((row) => row.permisos)
        .sort((a, b) => a.codigo.localeCompare(b.codigo)),
    }));
  }
}
