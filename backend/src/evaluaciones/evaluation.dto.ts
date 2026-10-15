import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class CreateEvaluationDto {
  @IsIn(['SI', 'NO', 'DESCONOCIDO']) edema!: 'SI' | 'NO' | 'DESCONOCIDO';
  @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/) nino_codigo!: string;
  @Matches(/^[1-9][0-9]{0,18}$/) centro_salud_id!: string;
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  evaluado_en!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.3) @Max(100) peso_kg!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(30) @Max(150) talla_cm!: number;
  @IsIn(['LONGITUD_ACOSTADO', 'TALLA_DE_PIE']) tipo_medicion!:
    'LONGITUD_ACOSTADO' | 'TALLA_DE_PIE';
  @IsIn(['CLINICA', 'VISITA_DOMICILIAR', 'JORNADA_COMUNITARIA', 'OTRO'])
  lugar_evaluacion:
    'CLINICA' | 'VISITA_DOMICILIAR' | 'JORNADA_COMUNITARIA' | 'OTRO' =
    'CLINICA';
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;
}
export class EvaluationSearchDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(3, 80)
  busqueda!: string;
}
export class ListEvaluationsDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) pagina = 1;
  @IsOptional() @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/) nino_codigo?: string;
}

export class EvaluationCodeDto {
  @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/) codigo!: string;
}

export class AnnulEvaluationDto {
  @IsString() @Length(5, 500) motivo!: string;
}
