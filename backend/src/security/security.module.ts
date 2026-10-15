import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityController } from './security.controller';

@Module({ imports: [PrismaModule], controllers: [SecurityController] })
export class SecurityModule {}
