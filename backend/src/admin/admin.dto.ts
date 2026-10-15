import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) pagina = 1;
  @IsOptional() @IsString() @MaxLength(80) buscar = '';
}
export class UserCode {
  @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/) codigo!: string;
}
export class PasswordBody {
  @IsString() @MinLength(12) @MaxLength(72) contrasena!: string;
}
export class CreateUser extends PasswordBody {
  @Matches(/^[A-Za-z0-9_.-]{3,40}$/) codigo_acceso!: string;
  @IsString() @MinLength(1) @MaxLength(120) nombres!: string;
  @IsString() @MinLength(1) @MaxLength(120) apellidos!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  roles!: number[];
}
export class EditUser {
  @IsString() @MinLength(1) @MaxLength(120) nombres!: string;
  @IsString() @MinLength(1) @MaxLength(120) apellidos!: string;
  @IsIn(['ACTIVO', 'INACTIVO', 'BLOQUEADO']) estado!:
    'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  roles!: number[];
  @IsString() @MinLength(5) @MaxLength(255) motivo!: string;
  @IsString() @MinLength(64) @MaxLength(64) revision!: string;
}
export class MenuCode {
  @Matches(/^[A-Z0-9_]{1,70}$/) codigo!: string;
}
export class EditMenu {
  @IsString() @MinLength(1) @MaxLength(120) nombre!: string;
  @IsInt() @Min(0) @Max(65535) orden!: number;
  @IsBoolean() visible!: boolean;
  @IsBoolean() activo!: boolean;
  @IsString() @MinLength(64) @MaxLength(64) revision!: string;
}

export class RoleCode {
  @Matches(/^[A-Z0-9_]{1,40}$/) codigo!: string;
}
export class EditRole {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  permisos!: string[];
  @IsString() @MinLength(64) @MaxLength(64) revision!: string;
  @IsString() @MinLength(5) @MaxLength(255) motivo!: string;
}
