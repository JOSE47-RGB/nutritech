import { MedicalReviewService } from './medical-review.service';
import { MedicalReviewDto, MedicalReviewParams } from './medical-review.dto';
import { EvaluationCalculationService } from './evaluation-calculation.service';
import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  Req,
  Param,
} from '@nestjs/common';
import { RequirePermissions } from '../permissions/require-permissions.decorator';
import type { AuthRequest } from '../auth/auth.types';
import {
  AnnulEvaluationDto,
  CreateEvaluationDto,
  EvaluationCodeDto,
  EvaluationSearchDto,
  ListEvaluationsDto,
} from './evaluation.dto';
import { EvaluacionesService } from './evaluaciones.service';
@Controller('evaluaciones')
export class EvaluacionesController {
  constructor(
    private readonly reviews: MedicalReviewService,
    private readonly service: EvaluacionesService,
    private readonly calculation: EvaluationCalculationService,
  ) {}
  @Get()
  @RequirePermissions('evaluaciones.ver')
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ListEvaluationsDto) {
    return this.service.list(query);
  }
  @Get('ninos')
  @RequirePermissions('evaluaciones.crear', 'ninos.buscar')
  @Header('Cache-Control', 'no-store')
  search(@Query() query: EvaluationSearchDto) {
    return this.service.search(query.busqueda);
  }
  @Get('pacientes-historial')
  @RequirePermissions('evaluaciones.ver')
  @Header('Cache-Control', 'no-store')
  historyPatients(@Query() query: EvaluationSearchDto) {
    return this.service.search(query.busqueda, true);
  }
  @Get('centros')
  @RequirePermissions('evaluaciones.crear')
  @Header('Cache-Control', 'no-store')
  centers(@Req() req: AuthRequest) {
    return this.service.centers(req.principal.usuarioId);
  }
  @Get(':codigo/calculo')
  @RequirePermissions('evaluaciones.ver')
  @Header('Cache-Control', 'no-store')
  preview(@Param() params: EvaluationCodeDto) {
    return this.calculation.preview(params.codigo);
  }
  @Get(':codigo/orientaciones')
  @RequirePermissions('evaluaciones.ver')
  @Header('Cache-Control', 'no-store')
  saved(@Param() params: EvaluationCodeDto) {
    return this.calculation.saved(params.codigo);
  }
  @Post(':codigo/orientaciones')
  @RequirePermissions('evaluaciones.ver', 'evaluaciones.crear')
  @Header('Cache-Control', 'no-store')
  save(@Param() params: EvaluationCodeDto, @Req() req: AuthRequest) {
    return this.calculation.preview(params.codigo, req.principal.usuarioId);
  }
  @Get(':codigo/orientaciones/:orientacion/valoraciones')
  @RequirePermissions('evaluaciones.ver')
  @Header('Cache-Control', 'no-store')
  reviewsList(@Param() params: MedicalReviewParams, @Req() req: AuthRequest) {
    return this.reviews.list(
      params.codigo,
      params.orientacion,
      req.principal.usuarioId,
    );
  }
  @Post(':codigo/orientaciones/:orientacion/valoraciones')
  @RequirePermissions('evaluaciones.ver', 'evaluaciones.valorar')
  @Header('Cache-Control', 'no-store')
  review(
    @Param() params: MedicalReviewParams,
    @Body() body: MedicalReviewDto,
    @Req() req: AuthRequest,
  ) {
    return this.reviews.create(
      params.codigo,
      params.orientacion,
      req.principal.usuarioId,
      body,
    );
  }
  @Post(':codigo/anular')
  @RequirePermissions('evaluaciones.ver', 'evaluaciones.anular')
  @Header('Cache-Control', 'no-store')
  annul(
    @Param() params: EvaluationCodeDto,
    @Body() dto: AnnulEvaluationDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.annul(
      params.codigo,
      dto.motivo,
      req.principal.usuarioId,
    );
  }
  @Post()
  @RequirePermissions('evaluaciones.crear')
  @Header('Cache-Control', 'no-store')
  create(@Body() dto: CreateEvaluationDto, @Req() req: AuthRequest) {
    return this.service.create(dto, req.principal.usuarioId);
  }
}
