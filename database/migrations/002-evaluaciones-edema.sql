-- Cambio aditivo: conserva evaluaciones y no infiere ausencia de edema.
ALTER TABLE evaluaciones_nutricionales
  ADD COLUMN IF NOT EXISTS edema ENUM('SI','NO','DESCONOCIDO')
  NOT NULL DEFAULT 'DESCONOCIDO' AFTER tipo_medicion;
