import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermissions } from '../permissions/require-permissions.decorator';
import type { AuthRequest } from '../auth/auth.types';
class CommunityBody {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  municipio!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  departamento!: string;
  @IsBoolean() activo!: boolean;
  @IsOptional() @Matches(/^[a-f0-9]{64}$/) revision?: string;
}
class CommunityId {
  @Matches(/^[1-9][0-9]{0,19}$/) id!: string;
}
class CommunityQuery {
  @IsOptional() @IsString() @MaxLength(120) buscar = '';
}
const fields = {
  id: true,
  nombre: true,
  municipio: true,
  departamento: true,
  activo: true,
} as const;
type Row = {
  id: bigint;
  nombre: string;
  municipio: string;
  departamento: string;
  activo: boolean;
};
function present(row: Row) {
  const data = { ...row, id: row.id.toString() };
  return {
    ...data,
    revision: createHash('sha256').update(JSON.stringify(data)).digest('hex'),
  };
}
@Injectable()
export class CommunitiesService {
  constructor(private readonly db: PrismaService) {}
  async list(buscar: string) {
    const rows = await this.db.comunidades.findMany({
      where: {
        OR: [
          { nombre: { contains: buscar.trim() } },
          { municipio: { contains: buscar.trim() } },
        ],
      },
      select: fields,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    return rows.map(present);
  }
  async save(dto: CommunityBody, actor: bigint, id?: string) {
    if (id && !dto.revision)
      throw new BadRequestException(
        'Vuelve a abrir la comunidad antes de editar.',
      );
    try {
      return await this.db.$transaction(async (tx) => {
        let before: Row | null = null;
        if (id) {
          await tx.$queryRaw`SELECT id FROM comunidades WHERE id = ${BigInt(id)} FOR UPDATE`;
          before = await tx.comunidades.findUnique({
            where: { id: BigInt(id) },
            select: fields,
          });
          if (!before)
            throw new NotFoundException('La comunidad ya no está disponible.');
          if (present(before).revision !== dto.revision)
            throw new ConflictException(
              'Otra persona cambió esta comunidad. Actualiza el listado y vuelve a editar.',
            );
        }
        const data = {
          nombre: dto.nombre,
          municipio: dto.municipio,
          departamento: dto.departamento,
          activo: dto.activo,
        };
        const row = id
          ? await tx.comunidades.update({
              where: { id: BigInt(id) },
              data,
              select: fields,
            })
          : await tx.comunidades.create({ data, select: fields });
        await tx.registros_auditoria.create({
          data: {
            usuario_id: actor,
            accion: id ? 'ACTUALIZAR' : 'INSERTAR',
            entidad: 'comunidades',
            entidad_id: row.id.toString(),
            datos_anteriores: before ? JSON.stringify(present(before)) : null,
            datos_nuevos: JSON.stringify(present(row)),
          },
        });
        return present(row);
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      )
        throw new ConflictException(
          'Ya existe esa comunidad en el mismo municipio y departamento.',
        );
      throw err;
    }
  }
}
@Controller('admin/comunidades')
@RequirePermissions('comunidades.gestionar')
export class CommunitiesController {
  constructor(private readonly service: CommunitiesService) {}
  @Get() @Header('Cache-Control', 'no-store') list(@Query() q: CommunityQuery) {
    return this.service.list(q.buscar);
  }
  @Post() create(@Body() body: CommunityBody, @Req() req: AuthRequest) {
    return this.service.save(body, req.principal.usuarioId);
  }
  @Post(':id') edit(
    @Param() p: CommunityId,
    @Body() body: CommunityBody,
    @Req() req: AuthRequest,
  ) {
    return this.service.save(body, req.principal.usuarioId, p.id);
  }
}
@Module({
  imports: [PrismaModule],
  controllers: [CommunitiesController],
  providers: [CommunitiesService],
})
export class CommunitiesModule {}
