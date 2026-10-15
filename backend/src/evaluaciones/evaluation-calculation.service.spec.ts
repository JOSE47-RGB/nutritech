import { createRequire } from 'node:module';
import { Prisma } from '@prisma/client';
import { ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { Reference } from '../nutrition/calculator';
import { EvaluationCalculationService } from './evaluation-calculation.service';
const { loadBundle } = createRequire(__filename)(
  '../../scripts/anthro-import.cjs',
) as { loadBundle: () => { rows: Reference[] } };
describe('Integridad de referencias al consultar un cálculo', () => {
  it.each(['faltante', 'alterada'])(
    'rechaza una referencia %s antes de devolver puntajes',
    async (mode) => {
      const rows = loadBundle().rows.map((row) => ({
        ...row,
        valor_l: new Prisma.Decimal(row.valor_l),
        valor_m: new Prisma.Decimal(row.valor_m),
        valor_s: new Prisma.Decimal(row.valor_s),
        tipos_indicador: {
          codigo: row.indicator,
          eje_referencia: row.indicator === 'P_T' ? 'TALLA_CM' : 'EDAD_DIAS',
          variable_resultado:
            row.indicator === 'T_E'
              ? 'TALLA_CM'
              : row.indicator === 'IMC_E'
                ? 'IMC'
                : 'PESO_KG',
          activo: true,
        },
      }));
      if (mode === 'faltante') rows.pop();
      else rows[0].valor_m = new Prisma.Decimal(999);
      const tx = {
        evaluaciones_nutricionales: {
          findUnique: () =>
            Promise.resolve({
              codigo_publico: 'TEST',
              estado: 'REGISTRADA',
              edad_dias: 700,
              peso_kg: new Prisma.Decimal(12),
              talla_cm: new Prisma.Decimal(85),
              tipo_medicion: 'LONGITUD_ACOSTADO',
              edema: 'NO',
              ninos: { sexo_biologico: 'M' },
            }),
        },
        patrones_crecimiento: {
          findUnique: () =>
            Promise.resolve({ id: 1, codigo: 'OMS-2006', activo: false }),
        },
        parametros_lms_edad: {
          findMany: () =>
            Promise.resolve(rows.filter((row) => row.edad_dias !== undefined)),
        },
        parametros_lms_talla: {
          findMany: () =>
            Promise.resolve(
              rows
                .filter((row) => row.talla_cm !== undefined)
                .map((row) => ({
                  ...row,
                  talla_cm: new Prisma.Decimal(row.talla_cm!),
                })),
            ),
        },
      };
      const prisma = {
        $transaction: async (
          callback: (client: typeof tx) => Promise<unknown>,
        ) => callback(tx),
      } as unknown as PrismaService;
      await expect(
        new EvaluationCalculationService(prisma).preview('TEST'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    },
  );
});
