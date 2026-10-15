import {
  Module,
  Controller,
  Get,
  Post,
  Header,
  Param,
  Query,
  Body,
  Req,
} from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { RequirePermissions } from '../permissions/require-permissions.decorator';
import type { AuthRequest } from '../auth/auth.types';
import { AlertsService } from './alerts.service';
import { AlertQuery, AlertCode, AlertChange } from './alerts.dto';
@Controller('alertas')
class AlertsController {
  constructor(private readonly service: AlertsService) {}
  @Get()
  @RequirePermissions('alertas.ver')
  @Header('Cache-Control', 'no-store')
  list(@Query() query: AlertQuery, @Req() req: AuthRequest) {
    return this.service.list(query, req.principal.usuarioId);
  }
  @Get(':codigo')
  @RequirePermissions('alertas.ver')
  @Header('Cache-Control', 'no-store')
  detail(@Param() params: AlertCode) {
    return this.service.detail(params.codigo);
  }
  @Post(':codigo/estado')
  @RequirePermissions('alertas.ver', 'alertas.atender')
  @Header('Cache-Control', 'no-store')
  change(
    @Param() params: AlertCode,
    @Body() dto: AlertChange,
    @Req() req: AuthRequest,
  ) {
    return this.service.change(params.codigo, dto, req.principal.usuarioId);
  }
}
@Module({
  imports: [PrismaModule, PermissionsModule],
  providers: [AlertsService],
  controllers: [AlertsController],
})
export class AlertsModule {}
