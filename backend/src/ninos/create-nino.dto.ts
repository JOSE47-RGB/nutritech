import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const optionalTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class CreateNinoDto {
  @IsString()
  @Length(4, 120)
  @Matches(/^[A-Za-z0-9\s-]+$/, {
    message: 'El certificado solo acepta letras, números, espacios y guiones.',
  })
  certificado!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 80)
  primer_nombre!: string;

  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @Length(1, 80)
  segundo_nombre?: string;

  @Transform(trim)
  @IsString()
  @Length(2, 80)
  primer_apellido!: string;

  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @Length(1, 80)
  segundo_apellido?: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener formato AAAA-MM-DD.',
  })
  fecha_nacimiento!: string;

  @IsIn(['M', 'F'])
  sexo_biologico!: 'M' | 'F';

  @IsOptional()
  @IsString()
  @Matches(/^[1-9][0-9]{0,19}$/)
  comunidad_id?: string;

  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion_referencia?: string;
}
