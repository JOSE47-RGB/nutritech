import { PermissionsModule } from '../permissions/permissions.module';
import { MedicalReviewService } from './medical-review.service';
import { EvaluationCalculationService } from './evaluation-calculation.service';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EvaluacionesController } from './evaluaciones.controller';
import { EvaluacionesService } from './evaluaciones.service';
@Module({
  imports: [PrismaModule, PermissionsModule],
  controllers: [EvaluacionesController],
  exports: [EvaluationCalculationService],
  providers: [
    MedicalReviewService,
    EvaluacionesService,
    EvaluationCalculationService,
  ],
})
export class EvaluacionesModule {}
