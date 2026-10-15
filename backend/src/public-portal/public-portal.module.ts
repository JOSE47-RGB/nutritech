import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Module,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { EvaluacionesModule } from '../evaluaciones/evaluaciones.module';
import { EvaluationCalculationService } from '../evaluaciones/evaluation-calculation.service';
import { GrowthReferenceQuery, GrowthTableQuery } from '../growth/growth.dto';
import { GrowthModule } from '../growth/growth.module';
import { GrowthService } from '../growth/growth.service';
import { ConsultationDto } from '../user-portal/consultation.dto';

// Solo referencias generales y cálculo efímero. No recibe identificadores de pacientes
// ni expone los métodos de expedientes, historial, guardado o administración.
@Controller('publico')
export class PublicPortalController {
  constructor(
    private readonly calculation: EvaluationCalculationService,
    private readonly growth: GrowthService,
  ) {}

  @Public()
  @Post('consulta')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  consultation(@Body() dto: ConsultationDto) {
    return this.calculation.consultation(dto);
  }

  @Public()
  @Get('crecimiento/tabla')
  @Header('Cache-Control', 'no-store')
  table(@Query() query: GrowthTableQuery) {
    return this.growth.table(query.sexo);
  }

  @Public()
  @Get('crecimiento/referencia')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  reference(@Query() query: GrowthReferenceQuery) {
    return this.growth.reference(query.sexo, query.edad_dias);
  }
}

@Module({
  imports: [EvaluacionesModule, GrowthModule],
  controllers: [PublicPortalController],
})
export class PublicPortalModule {}
