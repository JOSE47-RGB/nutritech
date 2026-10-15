import { GuardiansService } from './guardians.service';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CertificateService } from './certificate.service';
import { NinosService } from './ninos.service';
import { NinosController } from './ninos.controller';

@Module({
  imports: [PrismaModule],
  providers: [CertificateService, NinosService, GuardiansService],
  controllers: [NinosController],
  exports: [NinosService, GuardiansService],
})
export class NinosModule {}
