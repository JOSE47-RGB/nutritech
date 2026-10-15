import {
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { IsInt, IsUUID, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
import { Prisma } from '@prisma/client';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermissions } from '../permissions/require-permissions.decorator';
import type { AuthRequest } from '../auth/auth.types';
import { reportHtml, type ReportData } from './report-template';
class ReportCode {
  @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/) codigo!: string;
}
export class CreateReport {
  @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/) evaluacion!: string;
  @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/) orientacion!: string;
  @IsUUID('4') solicitud_id!: string;
}
class ReportQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) pagina = 1;
}
@Injectable()
export class ReportsService {
  constructor(private readonly db: PrismaService) {}
  async create(dto: CreateReport, actor: bigint) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM usuarios WHERE id=${actor} FOR UPDATE`;
        const old = await tx.reportes_generados.findUnique({
          where: {
            generado_por_solicitud_id: {
              generado_por: actor,
              solicitud_id: dto.solicitud_id,
            },
          },
          include: {
            orientacion: {
              select: {
                codigo_publico: true,
                evaluacion: { select: { codigo_publico: true } },
              },
            },
          },
        });
        if (old) {
          if (
            old.orientacion?.codigo_publico !== dto.orientacion ||
            old.orientacion.evaluacion.codigo_publico !== dto.evaluacion
          )
            throw new ConflictException(
              'Solicitud ya utilizada para otro reporte.',
            );
          return { codigo_publico: old.codigo_publico };
        }
        const row = await tx.orientaciones_guardadas.findUnique({
          where: { codigo_publico: dto.orientacion },
          include: {
            evaluacion: {
              include: {
                ninos: true,
                centros_salud: { select: { nombre: true } },
              },
            },
            valoraciones_medicas: {
              orderBy: { id: 'asc' },
              include: { medico: { select: { codigo_acceso: true } } },
            },
            alertas: {
              orderBy: { id: 'asc' },
              include: {
                historial_alerta: {
                  orderBy: { id: 'asc' },
                  include: { usuarios: { select: { codigo_acceso: true } } },
                },
              },
            },
          },
        });
        if (!row || row.evaluacion.codigo_publico !== dto.evaluacion)
          throw new NotFoundException(
            'No se encontró la orientación de esta evaluación.',
          );
        if (
          createHash('sha256').update(row.contenido).digest('hex') !==
          row.contenido_sha256
        )
          throw new ConflictException(
            'La orientación no supera la verificación de integridad.',
          );
        const user = await tx.usuarios.findUniqueOrThrow({
          where: { id: actor },
          select: { codigo_acceso: true },
        });
        const code = ulid();
        const now = new Date();
        const child = row.evaluacion.ninos;
        const data: ReportData = {
          codigo: code,
          fecha: now.toISOString(),
          autor: user.codigo_acceso,
          paciente: [
            child.primer_nombre,
            child.segundo_nombre,
            child.primer_apellido,
            child.segundo_apellido,
          ]
            .filter(Boolean)
            .join(' '),
          expediente: child.codigo_expediente,
          evaluacion: dto.evaluacion,
          estado_evaluacion: row.evaluacion.estado,
          centro: row.evaluacion.centros_salud.nombre,
          orientacion: dto.orientacion,
          guardada: row.guardado_en.toISOString(),
          hash_orientacion: row.contenido_sha256,
          calculo: JSON.parse(row.contenido) as ReportData['calculo'],
          valoraciones: row.valoraciones_medicas.map((v) => ({
            autor: v.medico.codigo_acceso,
            fecha: v.registrado_en.toISOString(),
            decision: v.decision,
            valoracion: v.valoracion,
            acciones: v.acciones,
          })),
          alertas: row.alertas.map((a) => ({
            codigo: a.codigo_publico,
            titulo: a.titulo,
            mensaje: a.mensaje,
            estado: a.estado,
            politica: a.version_politica,
            historial: a.historial_alerta.map((h) => ({
              autor: h.usuarios?.codigo_acceso ?? 'Sistema',
              fecha: h.cambiado_en.toISOString(),
              estado: h.estado_nuevo,
              comentario: h.comentario,
            })),
          })),
        };
        const html = reportHtml(data);
        const hash = createHash('sha256').update(html).digest();
        await tx.reportes_generados.create({
          data: {
            codigo_publico: code,
            tipo_reporte: 'EVALUACION_SEGUIMIENTO_V1',
            nino_id: child.id,
            formato: 'HTML',
            orientacion_id: row.id,
            solicitud_id: dto.solicitud_id,
            contenido_html: html,
            hash_sha256: hash,
            total_registros:
              data.calculo.orientacion.indicadores.length +
              data.valoraciones.length +
              data.alertas.length,
            generado_por: actor,
            generado_en: now,
          },
        });
        await tx.registros_auditoria.create({
          data: {
            usuario_id: actor,
            accion: 'EXPORTAR',
            entidad: 'reportes_generados',
            entidad_id: code,
            datos_nuevos: JSON.stringify({
              orientacion: dto.orientacion,
              formato: 'HTML',
              hash_sha256: hash.toString('hex'),
            }),
          },
        });
        return { codigo_publico: code };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 15000,
      },
    );
  }
  async list(query: ReportQuery) {
    const where = { tipo_reporte: 'EVALUACION_SEGUIMIENTO_V1' };
    const [total, rows] = await this.db.$transaction([
      this.db.reportes_generados.count({ where }),
      this.db.reportes_generados.findMany({
        where,
        skip: (query.pagina - 1) * 20,
        take: 20,
        orderBy: { id: 'desc' },
        select: {
          codigo_publico: true,
          generado_en: true,
          formato: true,
          usuarios: { select: { codigo_acceso: true } },
          orientacion: {
            select: {
              codigo_publico: true,
              evaluacion: { select: { codigo_publico: true } },
            },
          },
        },
      }),
    ]);
    return {
      total,
      pagina: query.pagina,
      paginas: Math.max(1, Math.ceil(total / 20)),
      datos: rows,
    };
  }
  async read(code: string, actor: bigint) {
    const row = await this.db.reportes_generados.findUnique({
      where: { codigo_publico: code },
    });
    if (!row || row.formato !== 'HTML' || !row.contenido_html)
      throw new NotFoundException('No se encontró el reporte imprimible.');
    if (row.expira_en && row.expira_en <= new Date())
      throw new ConflictException('El reporte ha vencido.');
    const hash = createHash('sha256').update(row.contenido_html).digest();
    if (!row.hash_sha256 || !hash.equals(Buffer.from(row.hash_sha256)))
      throw new ConflictException(
        'El reporte no supera la verificación de integridad.',
      );
    await this.db.registros_auditoria.create({
      data: {
        usuario_id: actor,
        accion: 'CONSULTAR',
        entidad: 'reportes_generados',
        entidad_id: code,
      },
    });
    return row.contenido_html;
  }
}
@Controller('reportes')
@RequirePermissions('reportes.generar', 'evaluaciones.ver', 'alertas.ver')
class ReportsController {
  constructor(private readonly service: ReportsService) {}
  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Body() dto: CreateReport, @Req() req: AuthRequest) {
    return this.service.create(dto, req.principal.usuarioId);
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ReportQuery) {
    return this.service.list(query);
  }
  @Get(':codigo/contenido')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
  )
  read(@Param() params: ReportCode, @Req() req: AuthRequest) {
    return this.service.read(params.codigo, req.principal.usuarioId);
  }
}
@Module({
  imports: [PrismaModule],
  providers: [ReportsService],
  exports: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
