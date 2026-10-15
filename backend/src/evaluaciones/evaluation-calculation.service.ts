import { familyGuidance } from '../nutrition/family-guidance';
import { measurementReview } from '../nutrition/measurement-review';
import { generateAlerts } from '../alerts/alert-generation';
import { ulid } from 'ulid';
import { DRAFT_RULES } from '../nutrition/classification-draft';
import { CONSOLIDATED_PROTOCOL } from '../nutrition/consolidated-protocol';
import { recommendations } from '../nutrition/recommendations';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  NutritionCalculator,
  type Reference,
  type Measurement,
} from '../nutrition/calculator';
const { loadBundle } = createRequire(__filename)(
  '../../scripts/anthro-import.cjs',
) as { loadBundle: () => { rows: Reference[]; commit: string } };
function fingerprint(rows: Reference[]) {
  return createHash('sha256')
    .update(
      rows
        .map((row) =>
          [
            row.indicator,
            row.sexo_biologico,
            row.edad_dias ??
              `${row.tipo_medicion}:${Number(row.talla_cm).toFixed(1)}`,
            ...[row.valor_l, row.valor_m, row.valor_s].map((value) =>
              Number(value).toFixed(8),
            ),
          ].join('|'),
        )
        .sort()
        .join('\n'),
    )
    .digest('hex');
}
@Injectable()
export class EvaluationCalculationService {
  constructor(private readonly prisma: PrismaService) {}
  async saved(code: string) {
    const evaluation = await this.prisma.evaluaciones_nutricionales.findUnique({
      where: { codigo_publico: code },
      select: { id: true },
    });
    if (!evaluation)
      throw new NotFoundException('No se encontró la evaluación.');
    const rows = await this.prisma.$queryRaw<
      SavedRow[]
    >`SELECT o.codigo_publico, o.guardado_en, o.contenido_sha256, o.contenido, u.codigo_acceso AS autor FROM orientaciones_guardadas o JOIN usuarios u ON u.id=o.guardado_por WHERE o.evaluacion_id=${evaluation.id} ORDER BY o.id DESC LIMIT 20`;
    return rows.map(savedView);
  }
  async consultation(input: Measurement) {
    return this.preview('', undefined, input);
  }
  async preview(code: string, actor?: bigint, input?: Measurement) {
    return this.prisma.$transaction(
      async (tx) => {
        if (actor !== undefined)
          await tx.$queryRaw`SELECT id FROM evaluaciones_nutricionales WHERE codigo_publico=${code} FOR UPDATE`;
        const evaluation = input
          ? {
              id: 0n,
              codigo_publico: '',
              estado: 'REGISTRADA',
              evaluado_en: new Date(),
              edad_dias: input.edad_dias,
              peso_kg: input.peso_kg,
              talla_cm: input.talla_cm,
              tipo_medicion: input.tipo_medicion,
              edema: input.edema,
              ninos: { sexo_biologico: input.sexo },
            }
          : await tx.evaluaciones_nutricionales.findUnique({
              where: { codigo_publico: code },
              select: {
                id: true,
                evaluado_en: true,
                codigo_publico: true,
                estado: true,
                edad_dias: true,
                peso_kg: true,
                talla_cm: true,
                tipo_medicion: true,
                edema: true,
                ninos: { select: { sexo_biologico: true } },
              },
            });
        if (!evaluation)
          throw new NotFoundException('No se encontró la evaluación.');
        if (evaluation.estado === 'ANULADA')
          throw new ConflictException('No se calculan evaluaciones anuladas.');
        let official: ReturnType<typeof loadBundle>;
        try {
          official = loadBundle();
        } catch {
          throw new ServiceUnavailableException(
            'No se pudo verificar la referencia nutricional.',
          );
        }
        const pattern = await tx.patrones_crecimiento.findUnique({
          where: { codigo: 'OMS-2006' },
          select: { id: true, codigo: true, activo: true },
        });
        if (!pattern)
          throw new ServiceUnavailableException(
            'No está disponible la referencia OMS-2006.',
          );
        const age = await tx.parametros_lms_edad.findMany({
          where: { patron_id: pattern.id },
          select: {
            sexo_biologico: true,
            edad_dias: true,
            valor_l: true,
            valor_m: true,
            valor_s: true,
            tipos_indicador: {
              select: {
                codigo: true,
                eje_referencia: true,
                variable_resultado: true,
                activo: true,
              },
            },
          },
        });
        const height = await tx.parametros_lms_talla.findMany({
          where: { patron_id: pattern.id },
          select: {
            sexo_biologico: true,
            talla_cm: true,
            tipo_medicion: true,
            valor_l: true,
            valor_m: true,
            valor_s: true,
            tipos_indicador: {
              select: {
                codigo: true,
                eje_referencia: true,
                variable_resultado: true,
                activo: true,
              },
            },
          },
        });
        const expected: Record<string, [string, string]> = {
          P_E: ['EDAD_DIAS', 'PESO_KG'],
          T_E: ['EDAD_DIAS', 'TALLA_CM'],
          IMC_E: ['EDAD_DIAS', 'IMC'],
          P_T: ['TALLA_CM', 'PESO_KG'],
        };
        for (const { tipos_indicador: i } of [...age, ...height])
          if (
            !i.activo ||
            !expected[i.codigo] ||
            i.eje_referencia !== expected[i.codigo][0] ||
            i.variable_resultado !== expected[i.codigo][1]
          )
            throw new ServiceUnavailableException(
              'La configuración de indicadores no coincide con el motor verificado.',
            );
        const rows: Reference[] = [
          ...age.map((row) => ({
            indicator: row.tipos_indicador.codigo as Reference['indicator'],
            sexo_biologico: row.sexo_biologico,
            edad_dias: row.edad_dias,
            valor_l: row.valor_l.toFixed(8),
            valor_m: row.valor_m.toFixed(8),
            valor_s: row.valor_s.toFixed(8),
          })),
          ...height.map((row) => ({
            indicator: row.tipos_indicador.codigo as Reference['indicator'],
            sexo_biologico: row.sexo_biologico,
            talla_cm: row.talla_cm.toFixed(1),
            tipo_medicion: row.tipo_medicion,
            valor_l: row.valor_l.toFixed(8),
            valor_m: row.valor_m.toFixed(8),
            valor_s: row.valor_s.toFixed(8),
          })),
        ];
        if (
          rows.length !== official.rows.length ||
          fingerprint(rows) !== fingerprint(official.rows)
        )
          throw new ServiceUnavailableException(
            'Las referencias cambiaron o están incompletas. Se requiere verificarlas antes de calcular.',
          );
        const result = new NutritionCalculator(rows).calculate({
          sexo: evaluation.ninos.sexo_biologico,
          edad_dias: evaluation.edad_dias,
          peso_kg: Number(evaluation.peso_kg),
          talla_cm: Number(evaluation.talla_cm),
          tipo_medicion: evaluation.tipo_medicion,
          edema: evaluation.edema,
        });
        const orientation = recommendations(result, evaluation.edema);
        // Comprobación de calidad de captura, nunca clasificación cuando hay edema.
        const quality =
          evaluation.edema === 'NO'
            ? result
            : new NutritionCalculator(rows).calculate({
                sexo: evaluation.ninos.sexo_biologico,
                edad_dias: evaluation.edad_dias,
                peso_kg: Number(evaluation.peso_kg),
                talla_cm: Number(evaluation.talla_cm),
                tipo_medicion: evaluation.tipo_medicion,
                edema: 'NO',
              });
        const reviewMeasurements = Object.values(quality.indicadores).some(
          (score) => score.fuera_rango_calidad === true,
        );
        const measurementIssues = measurementReview(
          {
            sexo: evaluation.ninos.sexo_biologico,
            edad_dias: evaluation.edad_dias,
            peso_kg: Number(evaluation.peso_kg),
            talla_cm: Number(evaluation.talla_cm),
            tipo_medicion: evaluation.tipo_medicion,
            edema: evaluation.edema,
          },
          quality,
        );
        const payload = {
          entrada: {
            edad_dias: evaluation.edad_dias,
            peso_kg: evaluation.peso_kg.toString(),
            talla_cm: evaluation.talla_cm.toString(),
            tipo_medicion: evaluation.tipo_medicion,
            edema: evaluation.edema,
            sexo: evaluation.ninos.sexo_biologico,
            evaluado_en: evaluation.evaluado_en.toISOString(),
          },
          referencias_sha256: fingerprint(rows),
          reglas_sha256: createHash('sha256')
            .update(JSON.stringify(DRAFT_RULES))
            .digest('hex'),
          version_consolidacion: CONSOLIDATED_PROTOCOL.version,
          codigo_publico: code,
          provisional: true,
          edema: evaluation.edema,
          patron: {
            codigo: pattern.codigo,
            activo: pattern.activo,
            commit: official.commit,
          },
          ...result,
          orientacion: orientation,
          guia_familiar: familyGuidance(
            orientation.indicadores,
            evaluation.edema,
            reviewMeasurements,
            measurementIssues,
          ),
        };
        if (input || actor === undefined) return payload;
        const content = JSON.stringify({
          ...payload,
          estado: 'ORIENTACION_AUTOMATICA',
          revision_medica: 'PENDIENTE',
          orientacion: { ...payload.orientacion, persistida: true },
        });
        const digest = createHash('sha256').update(content).digest('hex');
        const existing = await tx.$queryRaw<
          SavedRow[]
        >`SELECT o.codigo_publico, o.guardado_en, o.contenido_sha256, o.contenido, u.codigo_acceso AS autor FROM orientaciones_guardadas o JOIN usuarios u ON u.id=o.guardado_por WHERE o.evaluacion_id=${evaluation.id} AND o.contenido_sha256=${digest}`;
        if (existing.length) {
          const saved = savedView(existing[0]);
          await generateAlerts(
            tx,
            existing[0].codigo_publico,
            payload.orientacion,
            actor,
            measurementIssues,
          );
          return saved;
        }
        const publicCode = ulid();
        const now = new Date();
        const user = await tx.usuarios.findUniqueOrThrow({
          where: { id: actor },
          select: { codigo_acceso: true },
        });
        await tx.$executeRaw`INSERT INTO orientaciones_guardadas (codigo_publico,evaluacion_id,guardado_por,guardado_en,contenido_sha256,contenido) VALUES (${publicCode},${evaluation.id},${actor},${now},${digest},${content})`;
        await tx.registros_auditoria.create({
          data: {
            usuario_id: actor,
            accion: 'INSERTAR',
            entidad: 'orientaciones_guardadas',
            entidad_id: publicCode,
            datos_nuevos: JSON.stringify({
              evaluacion: code,
              contenido_sha256: digest,
            }),
          },
        });
        await generateAlerts(
          tx,
          publicCode,
          payload.orientacion,
          actor,
          measurementIssues,
        );
        return savedView({
          codigo_publico: publicCode,
          guardado_en: now,
          contenido_sha256: digest,
          contenido: content,
          autor: user.codigo_acceso,
        });
      },
      { timeout: 15000 },
    );
  }
}

interface SavedRow {
  codigo_publico: string;
  guardado_en: Date;
  contenido_sha256: string;
  contenido: string;
  autor: string;
}
function savedView(row: SavedRow) {
  if (
    createHash('sha256').update(row.contenido).digest('hex') !==
    row.contenido_sha256
  )
    throw new ConflictException(
      'La orientación guardada no supera la verificación de integridad.',
    );
  return {
    codigo_publico: row.codigo_publico,
    guardado_en: row.guardado_en.toISOString(),
    autor: row.autor,
    contenido_sha256: row.contenido_sha256,
    contenido: JSON.parse(row.contenido) as Record<string, unknown>,
  };
}
