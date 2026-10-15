import { Transform } from 'class-transformer';
import { IsString, Length, MaxLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(3, 40)
  codigo_acceso!: string;

  @IsString()
  @Length(1, 72)
  @MaxLength(72)
  contrasena!: string;
}
