import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import { PrismaService } from '../prisma/prisma.service';
import type { LinkGuardianDto } from './guardian.dto';

@Injectable()
export class GuardiansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly certificates: CertificateService,
  ) {}

  async search(text: string) {
    return this.prisma.responsables.findMany({
      where: {
        activo: true,
        ...(/^\d{13}$/.test(text.replace(/[\s-]/g, ''))
          ? { dpi_hash: this.certificates.guardianDpi(text).dpi_hash }
          : {
              AND: text.split(/\s+/).map((part) => ({
                OR: [
                  { nombres: { contains: part } },
                  { apellidos: { contains: part } },
                  { telefono: { contains: part } },
                ],
              })),
            }),
      },
      select: {
        codigo_publico: true,
        nombres: true,
        apellidos: true,
        telefono: true,
        dpi_ultimos4: true,
      },
      take: 20,
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }, { id: 'asc' }],
    });
  }

  private async lockChild(tx: Prisma.TransactionClient, code: string) {
    await tx.$queryRaw`SELECT id FROM ninos WHERE codigo_publico = ${code} FOR UPDATE`;
    const child = await tx.ninos.findUnique({
      where: { codigo_publico: code },
      select: { id: true, estado: true },
    });
    if (!child) throw new NotFoundException('No se encontró el expediente.');
    if (child.estado !== 'ACTIVO')
      throw new ConflictException(
        'Solo se pueden modificar responsables de expedientes activos.',
      );
    return child;
  }

  async link(code: string, dto: LinkGuardianDto, userId: bigint) {
    if (Boolean(dto.responsable) === Boolean(dto.responsable_codigo))
      throw new BadRequestException(
        'Selecciona un responsable existente o completa los datos de uno nuevo.',
      );
    if (
      dto.responsable?.telefono &&
      dto.responsable.telefono.replace(/\D/g, '').length < 7
    )
      throw new BadRequestException(
        'El teléfono debe contener al menos siete dígitos.',
      );
    const { dpi, ...details } = dto.responsable ?? {};
    const identity = dpi ? this.certificates.guardianDpi(dpi) : {};
    try {
      return await this.prisma.$transaction(async (tx) => {
        const child = await this.lockChild(tx, code);
        const now = new Date();
        const person = dto.responsable
          ? await tx.responsables.create({
              data: {
                ...details,
                nombres: dto.responsable.nombres,
                apellidos: dto.responsable.apellidos,
                ...identity,
                codigo_publico: ulid(),
                creado_en: now,
                actualizado_en: now,
              },
              select: { id: true, codigo_publico: true },
            })
          : await tx.responsables.findFirst({
              where: { codigo_publico: dto.responsable_codigo, activo: true },
              select: { id: true, codigo_publico: true },
            });
        if (!person)
          throw new NotFoundException(
            'El responsable no existe o está inactivo.',
          );
        if (
          await tx.nino_responsable.findUnique({
            where: {
              nino_id_responsable_id: {
                nino_id: child.id,
                responsable_id: person.id,
              },
            },
          })
        )
          throw new ConflictException(
            'Este responsable ya está vinculado al niño.',
          );
        if (dto.es_principal)
          await tx.nino_responsable.updateMany({
            where: { nino_id: child.id, es_principal: true },
            data: { es_principal: false },
          });
        await tx.nino_responsable.create({
          data: {
            nino_id: child.id,
            responsable_id: person.id,
            parentesco: dto.parentesco,
            es_principal: dto.es_principal,
            autorizado_contacto: dto.autorizado_contacto,
            registrado_por: userId,
            creado_en: now,
          },
        });
        await tx.registros_auditoria.create({
          data: {
            usuario_id: userId,
            accion: 'INSERTAR',
            entidad: 'nino_responsable',
            entidad_id: child.id.toString(),
            ocurrido_en: now,
            datos_nuevos: JSON.stringify({
              nino_codigo: code,
              responsable_codigo: person.codigo_publico,
              parentesco: dto.parentesco,
              es_principal: dto.es_principal,
              autorizado_contacto: dto.autorizado_contacto,
            }),
          },
        });
        return {
          mensaje: 'Responsable vinculado.',
          responsable_codigo: person.codigo_publico,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Este DPI o responsable ya está registrado o vinculado. Búscalo y selecciona el registro existente.',
        );
      throw error;
    }
  }

  async makePrimary(code: string, personCode: string, userId: bigint) {
    return this.prisma.$transaction(async (tx) => {
      const child = await this.lockChild(tx, code);
      const link = await tx.nino_responsable.findFirst({
        where: {
          nino_id: child.id,
          responsables: { codigo_publico: personCode, activo: true },
        },
        select: { responsable_id: true, es_principal: true },
      });
      if (!link)
        throw new NotFoundException(
          'El responsable no está vinculado a este niño o está inactivo.',
        );
      if (!link.es_principal) {
        const old = await tx.nino_responsable.findMany({
          where: { nino_id: child.id, es_principal: true },
          select: { responsables: { select: { codigo_publico: true } } },
        });
        await tx.nino_responsable.updateMany({
          where: { nino_id: child.id, es_principal: true },
          data: { es_principal: false },
        });
        await tx.nino_responsable.update({
          where: {
            nino_id_responsable_id: {
              nino_id: child.id,
              responsable_id: link.responsable_id,
            },
          },
          data: { es_principal: true },
        });
        await tx.registros_auditoria.create({
          data: {
            usuario_id: userId,
            accion: 'ACTUALIZAR',
            entidad: 'nino_responsable',
            entidad_id: child.id.toString(),
            ocurrido_en: new Date(),
            datos_anteriores: JSON.stringify({
              principales: old.map((row) => row.responsables.codigo_publico),
            }),
            datos_nuevos: JSON.stringify({ principal: personCode }),
          },
        });
      }
      return { mensaje: 'Responsable principal actualizado.' };
    });
  }
}
