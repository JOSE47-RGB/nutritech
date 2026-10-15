import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface MenuOption {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'ENLACE' | 'GRUPO' | 'SEPARADOR';
  ruta: string | null;
  icono: string | null;
  abre_nueva_pestana: boolean;
  hijos: MenuOption[];
}

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(userId: bigint) {
    // La vista ya aplica roles activos, permisos directos y denegaciones.
    const allowedRows = await this.prisma.$queryRaw<{ opcion_id: bigint }[]>`
      SELECT DISTINCT opcion_id FROM vw_menu_usuario WHERE usuario_id = ${userId}
    `;
    const allowed = new Set(allowedRows.map((row) => row.opcion_id.toString()));
    const modules = await this.prisma.modulos_menu.findMany({
      where: { activo: true },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        codigo: true,
        nombre: true,
        icono: true,
        opciones_menu: {
          where: { activo: true, visible: true },
          orderBy: [{ orden: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            menu_padre_id: true,
            codigo: true,
            nombre: true,
            tipo: true,
            ruta: true,
            icono: true,
            abre_nueva_pestana: true,
          },
        },
      },
    });
    return modules.flatMap((module) => {
      // Solo se recorren raíces y descendientes visibles del mismo módulo.
      // Los ciclos y huérfanos no tienen camino a una raíz y quedan excluidos.
      const children = new Map<string, typeof module.opciones_menu>();
      for (const option of module.opciones_menu) {
        const parent = option.menu_padre_id?.toString() ?? 'root';
        const siblings = children.get(parent) ?? [];
        siblings.push(option);
        children.set(parent, siblings);
      }
      const build = (parent: string): MenuOption[] => {
        const result: MenuOption[] = [];
        for (const option of children.get(parent) ?? []) {
          const id = option.id.toString();
          if (option.tipo !== 'GRUPO' && !allowed.has(id)) continue;
          const descendants = option.tipo === 'SEPARADOR' ? [] : build(id);
          if (option.tipo === 'GRUPO' && !descendants.length) continue;
          // Los módulos de NutriTech utilizan rutas internas, nunca javascript: ni URLs ajenas.
          if (
            option.tipo === 'ENLACE' &&
            (!option.ruta || !/^\/(?!\/)[^\\\s]*$/.test(option.ruta))
          )
            continue;
          if (
            option.tipo === 'SEPARADOR' &&
            (!result.length || result.at(-1)?.tipo === 'SEPARADOR')
          )
            continue;
          result.push({
            id,
            codigo: option.codigo,
            nombre: option.nombre,
            tipo: option.tipo,
            ruta: option.ruta,
            icono: option.icono,
            abre_nueva_pestana: option.abre_nueva_pestana,
            hijos: descendants,
          });
        }
        if (result.at(-1)?.tipo === 'SEPARADOR') result.pop();
        return result;
      };
      const opciones = build('root');
      return opciones.length
        ? [
            {
              id: module.id,
              codigo: module.codigo,
              nombre: module.nombre,
              icono: module.icono,
              opciones,
            },
          ]
        : [];
    });
  }
}
