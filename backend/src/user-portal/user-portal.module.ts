import { GuardiansService } from '../ninos/guardians.service';
import {
  GuardianSearchDto,
  LinkGuardianDto,
  PublicCodeDto,
} from '../ninos/guardian.dto';
import {
  Body,
  Controller,
  Get,
  Header,
  Module,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { NinosModule } from '../ninos/ninos.module';
import { NinosService } from '../ninos/ninos.service';
import { CreateNinoDto } from '../ninos/create-nino.dto';
import { ConsultationDto } from './consultation.dto';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { EvaluacionesModule } from '../evaluaciones/evaluaciones.module';
import { EvaluationCalculationService } from '../evaluaciones/evaluation-calculation.service';
import { EvaluationCodeDto } from '../evaluaciones/evaluation.dto';
import {
  ReportsModule,
  ReportsService,
  CreateReport,
} from '../reports/reports.module';
import { RequirePermissions } from '../permissions/require-permissions.decorator';
import type { AuthRequest } from '../auth/auth.types';

@Controller('mi-portal')
@RequirePermissions('evaluaciones.crear')
export class UserPortalController {
  constructor(
    private readonly db: PrismaService,
    private readonly ninos: NinosService,
    private readonly guardians: GuardiansService,
    private readonly calculation: EvaluationCalculationService,
    private readonly reports: ReportsService,
  ) {}
  private async ownEvaluation(code: string, actor: bigint) {
    const row = await this.db.evaluaciones_nutricionales.findFirst({
      where: { codigo_publico: code, registrado_por: actor },
      select: { id: true },
    });
    if (!row)
      throw new NotFoundException(
        'No se encontró una evaluación registrada por tu cuenta.',
      );
  }
  @Get('ninos/comunidades')
  @RequirePermissions('ninos.buscar')
  @Header('Cache-Control', 'no-store')
  communities() {
    return this.ninos.communities();
  }

  @Post('ninos')
  @RequirePermissions('ninos.buscar')
  @Header('Cache-Control', 'no-store')
  registerChild(@Body() dto: CreateNinoDto, @Req() req: AuthRequest) {
    return this.ninos.create(dto, req.principal.usuarioId);
  }

  @Post('ninos/responsables/buscar')
  @RequirePermissions('ninos.buscar')
  @Header('Cache-Control', 'no-store')
  searchGuardians(@Body() dto: GuardianSearchDto) {
    return this.guardians.search(dto.busqueda);
  }

  @Post('ninos/:codigo/responsables')
  @RequirePermissions('ninos.buscar')
  @Header('Cache-Control', 'no-store')
  async linkGuardian(
    @Param() params: PublicCodeDto,
    @Body() dto: LinkGuardianDto,
    @Req() req: AuthRequest,
  ) {
    const child = await this.db.ninos.findFirst({
      where: {
        codigo_publico: params.codigo,
        registrado_por: req.principal.usuarioId,
      },
      select: { id: true },
    });
    if (!child)
      throw new NotFoundException(
        'No se encontró un expediente registrado por tu cuenta.',
      );
    return this.guardians.link(params.codigo, dto, req.principal.usuarioId);
  }

  @Post('consulta')
  @Header('Cache-Control', 'no-store')
  consultation(@Body() dto: ConsultationDto) {
    return this.calculation.consultation(dto);
  }
  @Post('evaluaciones/:codigo/orientacion')
  @RequirePermissions('ninos.buscar')
  @Header('Cache-Control', 'no-store')
  async orientation(
    @Param() params: EvaluationCodeDto,
    @Req() req: AuthRequest,
  ) {
    await this.ownEvaluation(params.codigo, req.principal.usuarioId);
    return this.calculation.preview(params.codigo, req.principal.usuarioId);
  }
  @Post('reportes')
  @RequirePermissions('reportes.generar', 'alertas.ver')
  @Header('Cache-Control', 'no-store')
  async createReport(@Body() dto: CreateReport, @Req() req: AuthRequest) {
    await this.ownEvaluation(dto.evaluacion, req.principal.usuarioId);
    return this.reports.create(dto, req.principal.usuarioId);
  }
  @Get('reportes/:codigo/contenido')
  @RequirePermissions('reportes.generar', 'alertas.ver')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
  )
  async reportContent(
    @Param() params: EvaluationCodeDto,
    @Req() req: AuthRequest,
  ) {
    const report = await this.db.reportes_generados.findFirst({
      where: {
        codigo_publico: params.codigo,
        generado_por: req.principal.usuarioId,
        orientacion: {
          evaluacion: { registrado_por: req.principal.usuarioId },
        },
      },
      select: { codigo_publico: true },
    });
    if (!report)
      throw new NotFoundException(
        'No se encontró un reporte generado por tu cuenta.',
      );
    return this.reports.read(params.codigo, req.principal.usuarioId);
  }
}
@Module({
  imports: [PrismaModule, NinosModule, EvaluacionesModule, ReportsModule],
  controllers: [UserPortalController],
})
export class UserPortalModule {}
