import { Transform } from 'class-transformer';
import { IsIn, IsString, IsUUID, Length, Matches } from 'class-validator';
export class MedicalReviewParams {
  @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/) codigo!: string;
  @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/) orientacion!: string;
}
export class MedicalReviewDto {
  @IsUUID('4') solicitud_id!: string;
  @IsIn(['COINCIDE', 'DIFIERE', 'REQUIERE_INFORMACION']) decision!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(10, 4000)
  valoracion!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(10, 4000)
  acciones!: string;
}
