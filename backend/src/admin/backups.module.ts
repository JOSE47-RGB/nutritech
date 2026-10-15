import {
  Controller,
  Get,
  Header,
  Module,
  Post,
  Req,
  ServiceUnavailableException,
  ConflictException,
} from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermissions } from '../permissions/require-permissions.decorator';
import type { AuthRequest } from '../auth/auth.types';
const run = promisify(execFile);
@Controller('admin/respaldos')
@RequirePermissions('respaldos.gestionar')
export class BackupsController {
  private running = false;
  constructor(private readonly db: PrismaService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  async list() {
    const rows = await this.db.respaldos_bd.findMany({
      take: 50,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        estado: true,
        iniciado_en: true,
        finalizado_en: true,
        verificado_en: true,
        tamano_bytes: true,
        detalle_error: true,
      },
    });
    return {
      ejecutando: this.running,
      configurado: /^[a-f0-9]{64}$/i.test(
        process.env.BACKUP_ENCRYPTION_KEY ?? '',
      ),
      datos: rows.map((row) => ({
        ...row,
        id: row.id.toString(),
        tamano_bytes: row.tamano_bytes?.toString() ?? null,
      })),
    };
  }
  @Post()
  @Header('Cache-Control', 'no-store')
  async create(@Req() req: AuthRequest) {
    if (this.running)
      throw new ConflictException('Ya hay un respaldo en ejecución.');
    this.running = true;
    try {
      await run(
        process.execPath,
        [
          resolve('scripts/backup.cjs'),
          'create',
          req.principal.usuarioId.toString(),
        ],
        { timeout: 120000, maxBuffer: 65536 },
      );
      return {
        mensaje:
          'Respaldo cifrado creado e integridad verificada. La restauración se prueba por separado.',
      };
    } catch {
      throw new ServiceUnavailableException(
        'No se completó el respaldo. Consulta el registro y revisa la configuración del servidor.',
      );
    } finally {
      this.running = false;
    }
  }
}
@Module({ imports: [PrismaModule], controllers: [BackupsController] })
export class BackupsModule {}
