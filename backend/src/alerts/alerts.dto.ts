import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type { alertas_estado } from '@prisma/client';
export class AlertQuery {
  @IsOptional()
  @IsIn(['PENDIENTE', 'EN_REVISION', 'ATENDIDA', 'DESCARTADA'])
  estado?: alertas_estado;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) pagina = 1;
}
export class AlertCode {
  @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/) codigo!: string;
}
export class AlertChange {
  @IsIn(['EN_REVISION', 'ATENDIDA', 'DESCARTADA']) estado!: alertas_estado;
  @IsInt() @Min(0) revision!: number;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(10, 600)
  comentario!: string;
}
