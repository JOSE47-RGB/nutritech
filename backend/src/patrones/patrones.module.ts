import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PatronesController } from './patrones.controller';
import { PatronesService } from './patrones.service';
@Module({
  imports: [PrismaModule],
  controllers: [PatronesController],
  providers: [PatronesService],
})
export class PatronesModule {}
