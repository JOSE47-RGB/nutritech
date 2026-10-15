import { GrowthModule } from './growth/growth.module';
import { PublicPortalModule } from './public-portal/public-portal.module';
import { CommunitiesModule } from './admin/communities.module';
import { UserPortalModule } from './user-portal/user-portal.module';
import { BackupsModule } from './admin/backups.module';
import { AdminModule } from './admin/admin.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { AlertsModule } from './alerts/alerts.module';
import { PatronesModule } from './patrones/patrones.module';
import 'dotenv/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MenuModule } from './menu/menu.module';
import { SecurityModule } from './security/security.module';
import { NinosModule } from './ninos/ninos.module';
import { EvaluacionesModule } from './evaluaciones/evaluaciones.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    PublicPortalModule,
    GrowthModule,
    CommunitiesModule,
    UserPortalModule,
    BackupsModule,
    AdminModule,
    DashboardModule,
    ReportsModule,
    AlertsModule,
    PrismaModule,
    AuthModule,
    MenuModule,
    SecurityModule,
    NinosModule,
    EvaluacionesModule,
    PatronesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
