import {
  Controller,
  Get,
  Header,
  Injectable,
  Module,
  Req,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsModule } from '../permissions/permissions.module';
import { PermissionsService } from '../permissions/permissions.service';
import { RequirePermissions } from '../permissions/require-permissions.decorator';
import type { AuthRequest } from '../auth/auth.types';

@Injectable()
export class DashboardService {
  constructor(
    private readonly db: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}
  async summary(actor: bigint) {
    const allowed = await this.permissions.forUser(actor);
    return this.db.$transaction(
      async (tx) => ({
        consultado_en: new Date().toISOString(),
        ninos_activos: allowed.includes('ninos.ver')
          ? await tx.ninos.count({ where: { estado: 'ACTIVO' } })
          : null,
        evaluaciones_registradas: allowed.includes('evaluaciones.ver')
          ? await tx.evaluaciones_nutricionales.count({
              where: { estado: 'REGISTRADA' },
            })
          : null,
        orientaciones_sin_valoracion: allowed.includes('evaluaciones.ver')
          ? await tx.orientaciones_guardadas.count({
              where: {
                evaluacion: { estado: 'REGISTRADA' },
                valoraciones_medicas: { none: {} },
              },
            })
          : null,
        alertas_pendientes: allowed.includes('alertas.ver')
          ? await tx.alertas.count({ where: { estado: 'PENDIENTE' } })
          : null,
        alertas_en_revision: allowed.includes('alertas.ver')
          ? await tx.alertas.count({ where: { estado: 'EN_REVISION' } })
          : null,
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
@Controller('dashboard')
@RequirePermissions('dashboard.ver')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  get(@Req() req: AuthRequest) {
    return this.service.summary(req.principal.usuarioId);
  }
}
@Module({
  imports: [PrismaModule, PermissionsModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
