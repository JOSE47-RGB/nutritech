import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PatronesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const agesQuery = this.prisma.parametros_lms_edad.groupBy({
      by: ['patron_id', 'indicador_id', 'sexo_biologico'],
      orderBy: { patron_id: 'asc' },
      _count: { _all: true },
      _min: { edad_dias: true },
      _max: { edad_dias: true },
    });
    const heightsQuery = this.prisma.parametros_lms_talla.groupBy({
      by: ['patron_id', 'indicador_id', 'sexo_biologico', 'tipo_medicion'],
      orderBy: { patron_id: 'asc' },
      _count: { _all: true },
      _min: { talla_cm: true },
      _max: { talla_cm: true },
    });
    // Los conteos se calculan en SQL: no descargamos miles de coeficientes LMS.
    const [patterns, indicators, ages, heights] =
      await this.prisma.$transaction([
        this.prisma.patrones_crecimiento.findMany({
          orderBy: { codigo: 'asc' },
          select: {
            id: true,
            codigo: true,
            nombre: true,
            organizacion_fuente: true,
            version: true,
            referencia_documental: true,
            activo: true,
            vigente_desde: true,
            vigente_hasta: true,
            reglas_clasificacion: {
              orderBy: [
                { indicador_id: 'asc' },
                { orden: 'asc' },
                { codigo: 'asc' },
              ],
              select: {
                indicador_id: true,
                codigo: true,
                etiqueta: true,
                z_min: true,
                z_max: true,
                incluye_min: true,
                incluye_max: true,
                nivel_revision: true,
                genera_alerta: true,
                activa: true,
              },
            },
          },
        }),
        this.prisma.tipos_indicador.findMany({
          orderBy: { id: 'asc' },
          select: {
            id: true,
            codigo: true,
            nombre: true,
            eje_referencia: true,
            variable_resultado: true,
            unidad_resultado: true,
            activo: true,
          },
        }),
        agesQuery,
        heightsQuery,
      ]);
    return patterns.map(
      ({
        id,
        reglas_clasificacion,
        vigente_desde,
        vigente_hasta,
        ...pattern
      }) => ({
        ...pattern,
        vigente_desde: vigente_desde?.toISOString().slice(0, 10) ?? null,
        vigente_hasta: vigente_hasta?.toISOString().slice(0, 10) ?? null,
        indicadores: indicators.map(({ id: indicatorId, ...indicator }) => ({
          ...indicator,
          parametros_edad: ages
            .filter(
              (row) => row.patron_id === id && row.indicador_id === indicatorId,
            )
            .map((row) => ({
              sexo: row.sexo_biologico,
              cantidad: row._count._all,
              desde: row._min.edad_dias,
              hasta: row._max.edad_dias,
            }))
            .sort((a, b) => a.sexo.localeCompare(b.sexo)),
          parametros_talla: heights
            .filter(
              (row) => row.patron_id === id && row.indicador_id === indicatorId,
            )
            .map((row) => ({
              sexo: row.sexo_biologico,
              tipo_medicion: row.tipo_medicion,
              cantidad: row._count._all,
              desde: row._min.talla_cm?.toFixed(1) ?? null,
              hasta: row._max.talla_cm?.toFixed(1) ?? null,
            }))
            .sort(
              (a, b) =>
                a.sexo.localeCompare(b.sexo) ||
                a.tipo_medicion.localeCompare(b.tipo_medicion),
            ),
          reglas: reglas_clasificacion
            .filter((row) => row.indicador_id === indicatorId)
            .map(({ indicador_id, z_min, z_max, ...rule }) => {
              void indicador_id;
              return {
                ...rule,
                z_min: z_min?.toFixed(3) ?? null,
                z_max: z_max?.toFixed(3) ?? null,
              };
            }),
        })),
      }),
    );
  }
}
