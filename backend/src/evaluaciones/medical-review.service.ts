import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import type { MedicalReviewDto } from './medical-review.dto';
export interface RecordRow {
  codigo_publico: string;
  decision: string;
  valoracion: string;
  acciones: string;
  registrado_en: Date;
  autor: string;
}
@Injectable()
export class MedicalReviewService {
  constructor(
    private readonly db: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}
  async list(evaluation: string, orientation: string, actor: bigint) {
    const rows = await this.db.$queryRaw<
      { id: bigint; estado: string }[]
    >`SELECT o.id,e.estado FROM orientaciones_guardadas o JOIN evaluaciones_nutricionales e ON e.id=o.evaluacion_id WHERE o.codigo_publico=${orientation} AND e.codigo_publico=${evaluation}`;
    if (!rows.length)
      throw new NotFoundException(
        'No se encontró la orientación en esta evaluación.',
      );
    const history = await this.db.$queryRaw<
      RecordRow[]
    >`SELECT v.codigo_publico,v.decision,v.valoracion,v.acciones,v.registrado_en,u.codigo_acceso AS autor FROM valoraciones_medicas v JOIN usuarios u ON u.id=v.medico_id WHERE v.orientacion_id=${rows[0].id} ORDER BY v.id DESC LIMIT 20`;
    return {
      puede_valorar:
        rows[0].estado !== 'ANULADA' &&
        (await this.permissions.forUser(actor)).includes(
          'evaluaciones.valorar',
        ),
      datos: history,
    };
  }
  async create(
    evaluation: string,
    orientation: string,
    actor: bigint,
    dto: MedicalReviewDto,
  ) {
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        {
          id: bigint;
          estado: string;
          contenido: string;
          contenido_sha256: string;
        }[]
      >`SELECT o.id,e.estado,o.contenido,o.contenido_sha256 FROM evaluaciones_nutricionales e JOIN orientaciones_guardadas o ON o.evaluacion_id=e.id WHERE e.codigo_publico=${evaluation} AND o.codigo_publico=${orientation} FOR UPDATE`;
      if (!rows.length)
        throw new NotFoundException(
          'No se encontró la orientación en esta evaluación.',
        );
      const row = rows[0];
      if (row.estado === 'ANULADA')
        throw new ConflictException(
          'No se puede valorar una evaluación anulada.',
        );
      if (
        createHash('sha256').update(row.contenido).digest('hex') !==
        row.contenido_sha256
      )
        throw new ConflictException(
          'La orientación no supera la verificación de integridad.',
        );
      const existing = await tx.$queryRaw<
        RecordRow[]
      >`SELECT codigo_publico,decision,valoracion,acciones FROM valoraciones_medicas WHERE orientacion_id=${row.id} AND medico_id=${actor} AND solicitud_id=${dto.solicitud_id}`;
      if (existing.length) {
        const old = existing[0];
        if (
          old.decision !== dto.decision ||
          old.valoracion !== dto.valoracion ||
          old.acciones !== dto.acciones
        )
          throw new ConflictException(
            'Esta solicitud ya se usó con otro contenido.',
          );
        return { codigo_publico: old.codigo_publico };
      }
      const code = ulid();
      await tx.$executeRaw`INSERT INTO valoraciones_medicas (codigo_publico,orientacion_id,medico_id,solicitud_id,decision,valoracion,acciones) VALUES (${code},${row.id},${actor},${dto.solicitud_id},${dto.decision},${dto.valoracion},${dto.acciones})`;
      await tx.registros_auditoria.create({
        data: {
          usuario_id: actor,
          accion: 'INSERTAR',
          entidad: 'valoraciones_medicas',
          entidad_id: code,
          datos_nuevos: JSON.stringify({
            orientacion: orientation,
            decision: dto.decision,
          }),
        },
      });
      return { codigo_publico: code };
    });
  }
}
