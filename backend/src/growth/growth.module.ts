import {
  Controller,
  Get,
  Header,
  Module,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.types';
import { RequirePermissions } from '../permissions/require-permissions.decorator';
import { PrismaModule } from '../prisma/prisma.module';
import { GrowthService } from './growth.service';
import {
  GrowthCode,
  GrowthQuery,
  GrowthReferenceQuery,
  GrowthSearch,
  GrowthTableQuery,
} from './growth.dto';
@Controller('crecimiento')
@RequirePermissions('evaluaciones.ver')
export class GrowthController {
  constructor(private readonly service: GrowthService) {}
  @Get('tabla') @Header('Cache-Control', 'no-store') table(
    @Query() q: GrowthTableQuery,
  ) {
    return this.service.table(q.sexo);
  }
  @Get('ninos') @Header('Cache-Control', 'no-store') children(
    @Query() q: GrowthSearch,
  ) {
    return this.service.children(q.busqueda);
  }
  @Get('referencia') @Header('Cache-Control', 'no-store') reference(
    @Query() q: GrowthReferenceQuery,
  ) {
    return this.service.reference(q.sexo, q.edad_dias);
  }
  @Get('ninos/:codigo') @Header('Cache-Control', 'no-store') history(
    @Param() p: GrowthCode,
    @Query() q: GrowthQuery,
  ) {
    return this.service.history(p.codigo, q);
  }
}
@Controller('mi-portal/crecimiento')
export class PortalGrowthController {
  constructor(private readonly service: GrowthService) {}
  // La tabla es una guía general para cualquier sesión autenticada.
  @Get('tabla') @Header('Cache-Control', 'no-store') table(
    @Query() q: GrowthTableQuery,
  ) {
    return this.service.table(q.sexo);
  }
  @Get('ninos')
  @RequirePermissions('evaluaciones.crear', 'ninos.buscar')
  @Header('Cache-Control', 'no-store')
  children(@Query() q: GrowthSearch, @Req() req: AuthRequest) {
    return this.service.children(q.busqueda, req.principal.usuarioId);
  }
  @Get('referencia')
  @RequirePermissions('evaluaciones.crear')
  @Header('Cache-Control', 'no-store')
  reference(@Query() q: GrowthReferenceQuery) {
    return this.service.reference(q.sexo, q.edad_dias);
  }
  @Get('ninos/:codigo')
  @RequirePermissions('evaluaciones.crear', 'ninos.buscar')
  @Header('Cache-Control', 'no-store')
  history(
    @Param() p: GrowthCode,
    @Query() q: GrowthQuery,
    @Req() req: AuthRequest,
  ) {
    return this.service.history(p.codigo, q, req.principal.usuarioId);
  }
}
@Module({
  imports: [PrismaModule],
  providers: [GrowthService],
  exports: [GrowthService],
  controllers: [GrowthController, PortalGrowthController],
})
export class GrowthModule {}
