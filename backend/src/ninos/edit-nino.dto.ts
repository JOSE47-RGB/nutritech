import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class EditNinoDto {
  @Transform(trim) @IsString() @Length(2, 80) primer_nombre!: string;
  @Transform(trim) @IsString() @MaxLength(80) segundo_nombre!: string;
  @Transform(trim) @IsString() @Length(2, 80) primer_apellido!: string;
  @Transform(trim) @IsString() @MaxLength(80) segundo_apellido!: string;
  @Transform(trim) @IsString() @MaxLength(255) direccion_referencia!: string;
  @IsIn(['ACTIVO', 'INACTIVO', 'ARCHIVADO']) estado!:
    'ACTIVO' | 'INACTIVO' | 'ARCHIVADO';
  @IsInt() @Min(1) @Max(4294967294) version_registro!: number;
  @Transform(trim) @IsString() @Length(5, 500) motivo!: string;
}
