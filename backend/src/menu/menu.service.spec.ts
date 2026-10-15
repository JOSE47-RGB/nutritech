import { MenuService } from './menu.service';
import type { PrismaService } from '../prisma/prisma.service';

function option(
  id: bigint,
  tipo: 'ENLACE' | 'GRUPO' | 'SEPARADOR' = 'ENLACE',
  parent: bigint | null = null,
  ruta = '/ninos',
) {
  return {
    id,
    tipo,
    menu_padre_id: parent,
    ruta: tipo === 'ENLACE' ? ruta : null,
    codigo: `OP_${id}`,
    nombre: `Opción ${id}`,
    icono: null,
    abre_nueva_pestana: false,
  };
}

async function menu(options: ReturnType<typeof option>[], allowed: bigint[]) {
  const prisma = {
    $queryRaw: jest
      .fn()
      .mockResolvedValue(allowed.map((opcion_id) => ({ opcion_id }))),
    modulos_menu: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 1,
          codigo: 'TEST',
          nombre: 'Prueba',
          icono: null,
          opciones_menu: options,
        },
      ]),
    },
  };
  return new MenuService(prisma as unknown as PrismaService).forUser(1n);
}

describe('Construcción del menú autorizado', () => {
  it('incluye un grupo contenedor solo cuando tiene hijos permitidos', async () => {
    const result = await menu(
      [option(1n, 'GRUPO'), option(2n, 'ENLACE', 1n), option(3n)],
      [2n],
    );
    expect(result[0].opciones).toHaveLength(1);
    expect(result[0].opciones[0].id).toBe('1');
    expect(result[0].opciones[0].hijos[0].id).toBe('2');
  });

  it('omite grupos vacíos, huérfanos, ciclos y descendientes de padres no visibles', async () => {
    expect(
      await menu(
        [
          option(1n, 'GRUPO'),
          option(2n, 'ENLACE', 99n),
          option(3n, 'GRUPO', 4n),
          option(4n, 'GRUPO', 3n),
        ],
        [1n, 2n, 3n, 4n],
      ),
    ).toEqual([]);
  });

  it('no revela un enlace padre no autorizado aunque su hijo tenga permiso', async () => {
    expect(await menu([option(1n), option(2n, 'ENLACE', 1n)], [2n])).toEqual(
      [],
    );
  });

  it('excluye rutas externas o ejecutables y conserva las internas', async () => {
    const result = await menu(
      [
        option(1n, 'ENLACE', null, 'javascript:alert(1)'),
        option(2n, 'ENLACE', null, '//otro.example'),
        option(3n, 'ENLACE', null, '/admin/roles'),
      ],
      [1n, 2n, 3n],
    );
    expect(result[0].opciones.map((item) => item.id)).toEqual(['3']);
  });
});
