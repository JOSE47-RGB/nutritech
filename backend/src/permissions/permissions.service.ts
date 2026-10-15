import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(userId: bigint): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ permiso_codigo: string }[]>`
      SELECT permiso_codigo FROM vw_permisos_usuario
      WHERE usuario_id = ${userId} ORDER BY permiso_codigo
    `;
    return rows.map((row) => row.permiso_codigo);
  }
}
