import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsObject,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const optional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;
export class PublicCodeDto {
  @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/, {
    message: 'Código de expediente no válido.',
  })
  codigo!: string;
}
export class GuardianCodeDto extends PublicCodeDto {
  @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/, {
    message: 'Código de responsable no válido.',
  })
  responsable!: string;
}
export class GuardianSearchDto {
  @Transform(trim)
  @IsString()
  @Length(3, 80, { message: 'Escribe entre 3 y 80 caracteres para buscar.' })
  busqueda!: string;
}
export class NewGuardianDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.replace(/[\s-]/g, '') || undefined
      : value,
  )
  @IsOptional()
  @Matches(/^\d{13}$/, { message: 'El DPI debe tener 13 dígitos.' })
  dpi?: string;
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  nombres!: string;
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  apellidos!: string;
  @Transform(optional)
  @IsOptional()
  @IsString()
  @Length(7, 25)
  @Matches(/^[+0-9 ()-]+$/, { message: 'Revisa el formato del teléfono.' })
  telefono?: string;
  @Transform(optional)
  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @MaxLength(160)
  correo?: string;
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;
}
export class LinkGuardianDto {
  @IsOptional()
  @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/)
  responsable_codigo?: string;
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NewGuardianDto)
  responsable?: NewGuardianDto;
  @IsIn(['MADRE', 'PADRE', 'TUTOR', 'ABUELO_A', 'OTRO'])
  parentesco!: 'MADRE' | 'PADRE' | 'TUTOR' | 'ABUELO_A' | 'OTRO';
  @IsBoolean()
  es_principal = false;
  @IsBoolean()
  autorizado_contacto = true;
}
