import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListNinosDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  pagina = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limite = 20;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(80)
  busqueda?: string;

  @IsIn(['ACTIVO', 'INACTIVO', 'ARCHIVADO', 'TODOS'])
  estado: 'ACTIVO' | 'INACTIVO' | 'ARCHIVADO' | 'TODOS' = 'ACTIVO';
}
