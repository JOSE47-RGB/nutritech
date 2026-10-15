import { Type, Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class GrowthSearch {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(80)
  busqueda = '';
}
export class GrowthQuery {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) desde?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) hasta?: string;
  @IsIn(['dia', 'mes', 'ano']) agrupar: 'dia' | 'mes' | 'ano' = 'mes';
}
export class GrowthCode {
  @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/) codigo!: string;
}
export class GrowthTableQuery {
  @IsIn(['M', 'F']) sexo!: 'M' | 'F';
}
export class GrowthReferenceQuery extends GrowthTableQuery {
  @Type(() => Number) @IsInt() @Min(0) @Max(1826) edad_dias!: number;
}
