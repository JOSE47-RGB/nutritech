import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { Reference, Sex } from '../nutrition/calculator';
import { GrowthQuery } from './growth.dto';
import { monthlyReferences } from './growth-monthly';
import {
  GROWTH_SOURCE,
  localDate,
  periodKey,
  referenceWeight,
  weightWarning,
} from './growth-reference';
const { loadBundle } = createRequire(__filename)(
  '../../scripts/anthro-import.cjs',
) as { loadBundle: () => { rows: Reference[]; commit: string } };
const childFields = {
  codigo_publico: true,
  codigo_expediente: true,
  primer_nombre: true,
  segundo_nombre: true,
  primer_apellido: true,
  segundo_apellido: true,
  fecha_nacimiento: true,
  sexo_biologico: true,
} as const;
const childView = <T extends { fecha_nacimiento: Date }>(row: T) => ({
  ...row,
  fecha_nacimiento: row.fecha_nacimiento.toISOString().slice(0, 10),
});
function signature(rows: Reference[]) {
  return createHash('sha256')
    .update(
      rows
        .map((r) =>
          [
            r.sexo_biologico,
            r.edad_dias,
            ...[r.valor_l, r.valor_m, r.valor_s].map((v) =>
              Number(v).toFixed(8),
            ),
          ].join('|'),
        )
        .sort()
        .join('\n'),
    )
    .digest('hex');
}
export function dateBounds(query: GrowthQuery) {
  const parse = (value: string) => {
    const day = new Date(`${value}T00:00:00.000Z`);
    if (
      !Number.isFinite(day.getTime()) ||
      day.toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException('Revisa las fechas del filtro.');
    return new Date(`${value}T00:00:00-06:00`);
  };
  const start = query.desde ? parse(query.desde) : undefined;
  const last = query.hasta ? parse(query.hasta) : undefined;
  if (start && last && start > last)
    throw new BadRequestException(
      'La fecha inicial no puede ser posterior a la final.',
    );
  return {
    gte: start,
    lt: last ? new Date(last.getTime() + 86400000) : undefined,
  };
}
@Injectable()
export class GrowthService {
  constructor(private readonly db: PrismaService) {}
  table(sex: Sex) {
    try {
      return monthlyReferences(sex);
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo verificar la tabla OMS. Intenta nuevamente más tarde.',
      );
    }
  }
  async references() {
    try {
      const official = loadBundle();
      const expected = official.rows.filter((r) => r.indicator === 'P_E');
      const stored = await this.db.parametros_lms_edad.findMany({
        where: {
          patrones_crecimiento: { codigo: 'OMS-2006' },
          tipos_indicador: {
            codigo: 'P_E',
            activo: true,
            eje_referencia: 'EDAD_DIAS',
            variable_resultado: 'PESO_KG',
          },
        },
        select: {
          sexo_biologico: true,
          edad_dias: true,
          valor_l: true,
          valor_m: true,
          valor_s: true,
        },
      });
      const rows: Reference[] = stored.map((r) => ({
        ...r,
        indicator: 'P_E',
        valor_l: r.valor_l.toFixed(8),
        valor_m: r.valor_m.toFixed(8),
        valor_s: r.valor_s.toFixed(8),
      }));
      const sha256 = signature(rows);
      if (rows.length !== expected.length || sha256 !== signature(expected))
        throw new Error('Referencias no verificadas');
      return { rows, sha256, commit: official.commit };
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo verificar la referencia de peso para la edad.',
      );
    }
  }
  async reference(sex: Sex, days: number) {
    const bundle = await this.references();
    const reference = referenceWeight(bundle.rows, sex, days);
    if (!reference)
      throw new ServiceUnavailableException(
        'No hay referencia para esta edad.',
      );
    return {
      sexo: sex,
      edad_dias: days,
      referencia: reference,
      fuente: GROWTH_SOURCE,
      sha256: bundle.sha256,
    };
  }
  async children(search: string, actor?: bigint) {
    const rows = await this.db.ninos.findMany({
      where: {
        ...(actor !== undefined
          ? {
              OR: [
                { registrado_por: actor },
                {
                  evaluaciones_nutricionales: {
                    some: { registrado_por: actor, estado: { not: 'ANULADA' } },
                  },
                },
              ],
            }
          : {}),
        AND: [
          {
            OR: [
              { primer_nombre: { contains: search } },
              { primer_apellido: { contains: search } },
              { codigo_expediente: { contains: search } },
            ],
          },
        ],
      },
      select: childFields,
      orderBy: [{ primer_apellido: 'asc' }, { id: 'asc' }],
      take: 20,
    });
    return rows.map(childView);
  }
  async history(code: string, query: GrowthQuery, actor?: bigint) {
    const bounds = dateBounds(query);
    const child = await this.db.ninos.findFirst({
      where: {
        codigo_publico: code,
        ...(actor !== undefined
          ? {
              OR: [
                { registrado_por: actor },
                {
                  evaluaciones_nutricionales: {
                    some: { registrado_por: actor, estado: { not: 'ANULADA' } },
                  },
                },
              ],
            }
          : {}),
      },
      select: { ...childFields, id: true },
    });
    if (!child)
      throw new NotFoundException(
        'No se encontró un niño disponible para tu cuenta.',
      );
    const records = await this.db.evaluaciones_nutricionales.findMany({
      where: {
        nino_id: child.id,
        estado: { not: 'ANULADA' },
        evaluado_en: bounds,
        ...(actor !== undefined ? { registrado_por: actor } : {}),
      },
      select: {
        codigo_publico: true,
        evaluado_en: true,
        edad_dias: true,
        peso_kg: true,
        talla_cm: true,
        edema: true,
      },
      orderBy: [{ evaluado_en: 'asc' }, { id: 'asc' }],
      take: 1001,
    });
    if (records.length > 1000)
      throw new BadRequestException(
        'Hay más de 1000 registros. Acota las fechas para verlos sin omitir mediciones.',
      );
    let refs: Awaited<ReturnType<GrowthService['references']>> | null = null;
    try {
      refs = await this.references();
    } catch (err) {
      if (!(err instanceof ServiceUnavailableException)) throw err;
    }
    const measurements = records.map((r) => ({
      codigo: r.codigo_publico,
      evaluado_en: r.evaluado_en.toISOString(),
      fecha: localDate(r.evaluado_en),
      edad_dias: r.edad_dias,
      peso_kg: Number(r.peso_kg),
      talla_cm: Number(r.talla_cm),
      edema: r.edema,
      referencia: refs
        ? referenceWeight(refs.rows, child.sexo_biologico, r.edad_dias)
        : null,
      aviso: refs
        ? weightWarning(
            refs.rows,
            child.sexo_biologico,
            r.edad_dias,
            Number(r.peso_kg),
            r.edema,
          )
        : 'Referencia OMS no disponible; no interpretar la comparación.',
    }));
    const groups = new Map<
      string,
      {
        periodo: string;
        cantidad: number;
        ultima: (typeof measurements)[number];
      }
    >();
    for (const measurement of measurements) {
      const key = periodKey(measurement.fecha, query.agrupar);
      const count = groups.get(key)?.cantidad ?? 0;
      groups.set(key, {
        periodo: key,
        cantidad: count + 1,
        ultima: measurement,
      });
    }
    const { id: _id, ...publicChild } = child;
    void _id;
    return {
      nino: childView(publicChild),
      alcance:
        actor === undefined
          ? 'HISTORIAL_AUTORIZADO'
          : 'REGISTRADAS_POR_TU_CUENTA',
      zona_horaria: 'America/Guatemala',
      agrupacion: query.agrupar,
      total: measurements.length,
      mediciones: measurements,
      puntos: [...groups.values()],
      fuente: GROWTH_SOURCE,
      referencias_sha256: refs?.sha256 ?? null,
      aviso_referencia: refs
        ? null
        : 'No se pudo verificar la referencia OMS. Las mediciones guardadas siguen disponibles.',
    };
  }
}
