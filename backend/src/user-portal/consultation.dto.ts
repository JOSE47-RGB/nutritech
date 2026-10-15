import { IsIn, IsInt, IsNumber, Min, Max } from 'class-validator';
import type { Measurement } from '../nutrition/calculator';

export class ConsultationDto implements Measurement {
  @IsIn(['M', 'F']) sexo!: Measurement['sexo'];
  @IsInt() @Min(0) @Max(1856) edad_dias!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.3) @Max(100) peso_kg!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(30) @Max(150) talla_cm!: number;
  @IsIn(['LONGITUD_ACOSTADO', 'TALLA_DE_PIE'])
  tipo_medicion!: Measurement['tipo_medicion'];
  @IsIn(['SI', 'NO', 'DESCONOCIDO']) edema!: Measurement['edema'];
}
