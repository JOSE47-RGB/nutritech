import { PermissionsService } from '../permissions/permissions.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { compare, hashSync } from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SESSION_SECONDS } from './auth.config';
import type { LoginDto } from './login.dto';
import type { Principal } from './auth.types';

const INVALID = 'Código o contraseña incorrectos, o acceso no disponible.';
const DUMMY_HASH = hashSync(randomUUID(), 12);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly permissions: PermissionsService,
  ) {}

  async login(dto: LoginDto, agent?: string) {
    if (Buffer.byteLength(dto.contrasena, 'utf8') > 72) {
      throw new UnauthorizedException(INVALID);
    }
    // La transacción conserva el bloqueo hasta guardar el contador o la sesión.
    const result = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM usuarios WHERE codigo_acceso = ${dto.codigo_acceso} FOR UPDATE`;
        const user = await tx.usuarios.findUnique({
          where: { codigo_acceso: dto.codigo_acceso },
        });
        const passwordMatches = await compare(
          dto.contrasena,
          user?.contrasena_hash ?? DUMMY_HASH,
        );
        const now = new Date();
        if (
          !user ||
          user.estado !== 'ACTIVO' ||
          user.desactivado_en ||
          (user.bloqueado_hasta && user.bloqueado_hasta > now)
        )
          return null;

        if (!passwordMatches) {
          const failures =
            (user.bloqueado_hasta ? 0 : user.intentos_fallidos) + 1;
          await tx.usuarios.update({
            where: { id: user.id },
            data: {
              intentos_fallidos: Math.min(failures, 5),
              bloqueado_hasta:
                failures >= 5 ? new Date(now.getTime() + 15 * 60_000) : null,
            },
          });
          return null; // Lanzar dentro de la transacción revertiría el contador.
        }

        const exp = Math.floor(now.getTime() / 1000) + SESSION_SECONDS;
        const token = await this.jwt.signAsync({
          sub: user.id.toString(),
          jti: randomUUID(),
          exp,
        });
        await tx.sesiones_usuario.create({
          data: {
            usuario_id: user.id,
            token_hash: this.tokenHash(token),
            iniciada_en: now,
            expira_en: new Date(exp * 1000),
            agente_usuario: agent?.slice(0, 500),
          },
        });
        await tx.usuarios.update({
          where: { id: user.id },
          data: {
            intentos_fallidos: 0,
            bloqueado_hasta: null,
            ultimo_acceso_en: now,
          },
        });
        await tx.registros_auditoria.create({
          data: {
            usuario_id: user.id,
            accion: 'INICIAR_SESION',
            entidad: 'usuarios',
            entidad_id: user.id.toString(),
            agente_usuario: agent?.slice(0, 500),
          },
        });
        return { token };
      },
      { timeout: 10_000 },
    );
    if (!result) throw new UnauthorizedException(INVALID);
    return result;
  }

  async authenticate(token: string): Promise<Principal> {
    let payload: { sub?: unknown; jti?: unknown; exp?: unknown };
    try {
      payload = await this.jwt.verifyAsync(token, {
        algorithms: ['HS256'],
        issuer: 'nutritech',
        audience: 'nutritech-web',
      });
    } catch {
      throw new UnauthorizedException('Sesión no válida o vencida.');
    }
    if (
      typeof payload.sub !== 'string' ||
      !/^[1-9][0-9]{0,19}$/.test(payload.sub) ||
      typeof payload.jti !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      throw new UnauthorizedException('Sesión no válida.');
    }
    const session = await this.prisma.sesiones_usuario.findUnique({
      where: { token_hash: this.tokenHash(token) },
      include: { usuarios: true },
    });
    if (
      !session ||
      session.usuario_id.toString() !== payload.sub ||
      session.revocada_en ||
      session.expira_en <= new Date() ||
      session.usuarios.estado !== 'ACTIVO' ||
      session.usuarios.desactivado_en
    ) {
      throw new UnauthorizedException('Sesión no válida o vencida.');
    }
    return {
      usuarioId: session.usuario_id,
      sesionId: session.id,
      expiraEn: session.expira_en.toISOString(),
    };
  }

  async profile(id: bigint) {
    const user = await this.prisma.usuarios.findUniqueOrThrow({
      where: { id },
      select: {
        codigo_publico: true,
        codigo_acceso: true,
        nombres: true,
        apellidos: true,
      },
    });
    const assignments = await this.prisma.usuario_rol.findMany({
      where: { usuario_id: id, roles: { activo: true } },
      select: { roles: { select: { codigo: true, nombre: true } } },
    });
    const permissions = await this.permissions.forUser(id);
    return {
      ...user,
      roles: assignments.map((row) => row.roles),
      permisos: permissions,
    };
  }

  async logout(principal: Principal) {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.sesiones_usuario.updateMany({
        where: {
          id: principal.sesionId,
          usuario_id: principal.usuarioId,
          revocada_en: null,
        },
        data: {
          revocada_en: new Date(),
          motivo_revocacion: 'Cierre de sesión',
        },
      });
      if (result.count)
        await tx.registros_auditoria.create({
          data: {
            usuario_id: principal.usuarioId,
            accion: 'CERRAR_SESION',
            entidad: 'sesiones_usuario',
            entidad_id: principal.sesionId.toString(),
          },
        });
    });
  }

  private tokenHash(token: string) {
    return createHash('sha256').update(token).digest();
  }
}
