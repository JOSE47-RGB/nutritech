import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from 'bcrypt';
import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUser,
  EditMenu,
  EditUser,
  PageQuery,
  EditRole,
} from './admin.dto';
const selection = {
  id: true,
  codigo_publico: true,
  codigo_acceso: true,
  nombres: true,
  apellidos: true,
  estado: true,
  usuario_rol_usuario_rol_usuario_idTousuarios: {
    select: { roles: { select: { id: true, nombre: true } } },
  },
} satisfies Prisma.usuariosSelect;
const fingerprint = (value: unknown) =>
  createHash('sha256')
    .update(
      JSON.stringify(value, (_, v: unknown) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    )
    .digest('hex');
function publicUser(
  user: Prisma.usuariosGetPayload<{ select: typeof selection }>,
) {
  const {
    id: _id,
    usuario_rol_usuario_rol_usuario_idTousuarios: links,
    ...row
  } = user;
  void _id;
  return {
    ...row,
    roles: links.map((l) => l.roles).sort((a, b) => a.id - b.id),
    revision: fingerprint(user),
  };
}
@Injectable()
export class AdminService {
  constructor(private readonly db: PrismaService) {}
  async roleCatalog() {
    const roles = await this.db.roles.findMany({
      orderBy: { id: 'asc' },
      select: {
        codigo: true,
        nombre: true,
        activo: true,
        rol_permiso: {
          orderBy: { permiso_id: 'asc' },
          select: { permisos: { select: { codigo: true } } },
        },
      },
    });
    const permisos = await this.db.permisos.findMany({
      where: { activo: true },
      orderBy: { codigo: 'asc' },
      select: { codigo: true, descripcion: true },
    });
    return {
      permisos,
      roles: roles.map((row) => ({
        codigo: row.codigo,
        nombre: row.nombre,
        activo: row.activo,
        permisos: row.rol_permiso.map((p) => p.permisos.codigo),
        revision: fingerprint(row),
      })),
    };
  }
  async editRole(code: string, dto: EditRole, actor: bigint) {
    if (code === 'ADMINISTRADOR')
      throw new ConflictException(
        'Los permisos del rol administrador se conservan.',
      );
    if (dto.motivo.trim().length < 5)
      throw new BadRequestException('Escribe el motivo del cambio.');
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM roles WHERE codigo = ${code} FOR UPDATE`;
      const role = await tx.roles.findUnique({
        where: { codigo: code },
        select: {
          codigo: true,
          nombre: true,
          activo: true,
          rol_permiso: {
            orderBy: { permiso_id: 'asc' },
            select: { permisos: { select: { codigo: true } } },
          },
        },
      });
      if (!role || !role.activo)
        throw new NotFoundException('Rol activo no encontrado.');
      if (fingerprint(role) !== dto.revision)
        throw new ConflictException(
          'El rol cambió. Actualiza antes de guardar.',
        );
      const id = (await tx.roles.findUniqueOrThrow({ where: { codigo: code } }))
        .id;
      if (
        await tx.usuario_rol.count({ where: { usuario_id: actor, rol_id: id } })
      )
        throw new ConflictException(
          'No puedes modificar un rol asignado a tu propia cuenta.',
        );
      const perms = await tx.permisos.findMany({
        where: { codigo: { in: dto.permisos }, activo: true },
        select: { id: true },
      });
      if (perms.length !== dto.permisos.length)
        throw new BadRequestException('Hay permisos desconocidos o inactivos.');
      await tx.rol_permiso.deleteMany({ where: { rol_id: id } });
      if (perms.length)
        await tx.rol_permiso.createMany({
          data: perms.map((p) => ({ rol_id: id, permiso_id: p.id })),
        });
      await tx.sesiones_usuario.updateMany({
        where: {
          revocada_en: null,
          usuarios: {
            usuario_rol_usuario_rol_usuario_idTousuarios: {
              some: { rol_id: id },
            },
          },
        },
        data: {
          revocada_en: new Date(),
          motivo_revocacion: 'Permisos del rol actualizados',
        },
      });
      await tx.registros_auditoria.create({
        data: {
          usuario_id: actor,
          accion: 'ACTUALIZAR',
          entidad: 'roles',
          entidad_id: code,
          datos_anteriores: JSON.stringify(role.rol_permiso),
          datos_nuevos: JSON.stringify({
            permisos: dto.permisos,
            motivo: dto.motivo,
          }),
        },
      });
      return {
        mensaje:
          'Permisos actualizados; sesiones de los usuarios afectados cerradas.',
      };
    });
  }
  async users(query: PageQuery) {
    const where: Prisma.usuariosWhereInput = query.buscar
      ? {
          OR: [
            { codigo_acceso: { contains: query.buscar } },
            { nombres: { contains: query.buscar } },
            { apellidos: { contains: query.buscar } },
          ],
        }
      : {};
    const [total, rows] = await this.db.$transaction([
      this.db.usuarios.count({ where }),
      this.db.usuarios.findMany({
        where,
        select: selection,
        orderBy: { id: 'desc' },
        skip: (query.pagina - 1) * 20,
        take: 20,
      }),
    ]);
    return {
      total,
      pagina: query.pagina,
      paginas: Math.max(1, Math.ceil(total / 20)),
      datos: rows.map(publicUser),
    };
  }
  async roles(tx: Prisma.TransactionClient, ids: number[]) {
    if (
      (await tx.roles.count({ where: { id: { in: ids }, activo: true } })) !==
      ids.length
    )
      throw new BadRequestException('Selecciona roles activos válidos.');
  }
  async create(dto: CreateUser, actor: bigint) {
    if (Buffer.byteLength(dto.contrasena, 'utf8') > 72)
      throw new BadRequestException('La contraseña supera 72 bytes UTF-8.');
    if (!dto.nombres.trim() || !dto.apellidos.trim())
      throw new BadRequestException('Completa nombres y apellidos.');
    const passwordHash = await hash(dto.contrasena, 12);
    try {
      return await this.db.$transaction(async (tx) => {
        await this.roles(tx, dto.roles);
        const user = await tx.usuarios.create({
          data: {
            codigo_publico: ulid(),
            codigo_acceso: dto.codigo_acceso,
            nombres: dto.nombres.trim(),
            apellidos: dto.apellidos.trim(),
            contrasena_hash: passwordHash,
            creado_por: actor,
          },
        });
        await tx.usuario_rol.createMany({
          data: dto.roles.map((rol_id) => ({
            usuario_id: user.id,
            rol_id,
            asignado_por: actor,
          })),
        });
        await tx.registros_auditoria.create({
          data: {
            usuario_id: actor,
            accion: 'INSERTAR',
            entidad: 'usuarios',
            entidad_id: user.codigo_publico,
            datos_nuevos: JSON.stringify({
              codigo_acceso: dto.codigo_acceso,
              roles: dto.roles,
            }),
          },
        });
        return { codigo_publico: user.codigo_publico };
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException('El código de acceso ya está registrado.');
      throw e;
    }
  }
  async edit(code: string, dto: EditUser, actor: bigint) {
    if (
      !dto.nombres.trim() ||
      !dto.apellidos.trim() ||
      dto.motivo.trim().length < 5
    )
      throw new BadRequestException('Completa los datos y el motivo.');
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM usuarios WHERE codigo_publico = ${code} FOR UPDATE`;
      const user = await tx.usuarios.findUnique({
        where: { codigo_publico: code },
        select: selection,
      });
      if (!user) throw new NotFoundException('Usuario no encontrado.');
      if (user.id === actor)
        throw new ConflictException(
          'No puedes modificar tu propia cuenta desde administración.',
        );
      if (fingerprint(user) !== dto.revision)
        throw new ConflictException(
          'La cuenta cambió. Actualiza el listado antes de guardar.',
        );
      await this.roles(tx, dto.roles);
      // Conserva las cuentas administrativas existentes para evitar bloqueos y
      // cambios concurrentes que eliminen al último administrador.
      const admin = await tx.roles.findUnique({
        where: { codigo: 'ADMINISTRADOR' },
      });
      if (
        admin &&
        user.usuario_rol_usuario_rol_usuario_idTousuarios.some(
          (l) => l.roles.id === admin.id,
        ) &&
        (dto.estado !== 'ACTIVO' || !dto.roles.includes(admin.id))
      )
        throw new ConflictException(
          'El acceso de las cuentas administrativas existentes se conserva.',
        );
      await tx.usuarios.update({
        where: { id: user.id },
        data: {
          nombres: dto.nombres.trim(),
          apellidos: dto.apellidos.trim(),
          estado: dto.estado,
          desactivado_en: dto.estado === 'INACTIVO' ? new Date() : null,
          intentos_fallidos: 0,
          bloqueado_hasta: null,
        },
      });
      await tx.usuario_rol.deleteMany({ where: { usuario_id: user.id } });
      await tx.usuario_rol.createMany({
        data: dto.roles.map((rol_id) => ({
          usuario_id: user.id,
          rol_id,
          asignado_por: actor,
        })),
      });
      await tx.sesiones_usuario.updateMany({
        where: { usuario_id: user.id, revocada_en: null },
        data: {
          revocada_en: new Date(),
          motivo_revocacion: 'Cuenta actualizada por administración',
        },
      });
      await tx.registros_auditoria.create({
        data: {
          usuario_id: actor,
          accion: 'ACTUALIZAR',
          entidad: 'usuarios',
          entidad_id: code,
          datos_anteriores: JSON.stringify(publicUser(user)),
          datos_nuevos: JSON.stringify({ ...dto, revision: undefined }),
        },
      });
      return {
        mensaje: 'Cuenta actualizada. Se cerraron sus sesiones anteriores.',
      };
    });
  }
  async reset(code: string, password: string, actor: bigint) {
    if (Buffer.byteLength(password, 'utf8') > 72)
      throw new BadRequestException('La contraseña supera 72 bytes UTF-8.');
    const passwordHash = await hash(password, 12);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM usuarios WHERE codigo_publico = ${code} FOR UPDATE`;
      const user = await tx.usuarios.findUnique({
        where: { codigo_publico: code },
      });
      if (!user) throw new NotFoundException('Usuario no encontrado.');
      if (user.id === actor)
        throw new ConflictException(
          'Usa el comando auth:reset-password para tu propia cuenta.',
        );
      await tx.usuarios.update({
        where: { id: user.id },
        data: {
          contrasena_hash: passwordHash,
          intentos_fallidos: 0,
          bloqueado_hasta: null,
        },
      });
      await tx.sesiones_usuario.updateMany({
        where: { usuario_id: user.id, revocada_en: null },
        data: {
          revocada_en: new Date(),
          motivo_revocacion: 'Restablecimiento administrativo',
        },
      });
      await tx.registros_auditoria.create({
        data: {
          usuario_id: actor,
          accion: 'ACTUALIZAR',
          entidad: 'usuarios',
          entidad_id: code,
          datos_nuevos: JSON.stringify({ contrasena_restablecida: true }),
        },
      });
      return {
        mensaje:
          'Contraseña restablecida. Se cerraron las sesiones anteriores.',
      };
    });
  }
  async audit(query: PageQuery) {
    const where: Prisma.registros_auditoriaWhereInput = query.buscar
      ? { entidad: { contains: query.buscar } }
      : {};
    const [total, rows] = await this.db.$transaction([
      this.db.registros_auditoria.count({ where }),
      this.db.registros_auditoria.findMany({
        where,
        skip: (query.pagina - 1) * 20,
        take: 20,
        orderBy: { id: 'desc' },
        select: {
          id: true,
          accion: true,
          entidad: true,
          entidad_id: true,
          ocurrido_en: true,
          usuarios: { select: { codigo_acceso: true } },
        },
      }),
    ]);
    return {
      total,
      pagina: query.pagina,
      paginas: Math.max(1, Math.ceil(total / 20)),
      datos: rows.map((r) => ({ ...r, id: r.id.toString() })),
    };
  }
  async menus() {
    const rows = await this.db.opciones_menu.findMany({
      orderBy: [{ modulo_menu_id: 'asc' }, { orden: 'asc' }, { id: 'asc' }],
      select: {
        codigo: true,
        nombre: true,
        ruta: true,
        tipo: true,
        orden: true,
        visible: true,
        activo: true,
        modulos_menu: { select: { nombre: true } },
      },
    });
    return rows.map((r) => ({ ...r, revision: fingerprint(r) }));
  }
  async editMenu(code: string, dto: EditMenu, actor: bigint) {
    if (!dto.nombre.trim()) throw new BadRequestException('Escribe un nombre.');
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM opciones_menu WHERE codigo = ${code} FOR UPDATE`;
      const row = await tx.opciones_menu.findUnique({
        where: { codigo: code },
        select: {
          codigo: true,
          nombre: true,
          ruta: true,
          tipo: true,
          orden: true,
          visible: true,
          activo: true,
          modulos_menu: { select: { nombre: true } },
        },
      });
      if (!row) throw new NotFoundException('Opción no encontrada.');
      if (fingerprint(row) !== dto.revision)
        throw new ConflictException(
          'El menú cambió. Actualiza antes de guardar.',
        );
      if (code === 'MENUS_GESTIONAR' && (!dto.activo || !dto.visible))
        throw new ConflictException(
          'Conserva visible el acceso a la configuración del menú.',
        );
      await tx.opciones_menu.update({
        where: { codigo: code },
        data: {
          nombre: dto.nombre.trim(),
          orden: dto.orden,
          visible: dto.visible,
          activo: dto.activo,
        },
      });
      await tx.registros_auditoria.create({
        data: {
          usuario_id: actor,
          accion: 'ACTUALIZAR',
          entidad: 'opciones_menu',
          entidad_id: code,
          datos_anteriores: JSON.stringify(row),
          datos_nuevos: JSON.stringify(dto),
        },
      });
      return {
        mensaje: 'Menú actualizado. Usa Actualizar menú para ver los cambios.',
      };
    });
  }
}
