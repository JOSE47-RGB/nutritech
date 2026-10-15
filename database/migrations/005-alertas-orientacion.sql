ALTER TABLE alertas
 MODIFY resultado_indicador_id BIGINT UNSIGNED NULL,
 ADD orientacion_id BIGINT UNSIGNED NULL,
 ADD tipo_aviso VARCHAR(30) NULL,
 ADD regla_aviso VARCHAR(100) NULL,
 ADD version_politica VARCHAR(50) NULL,
 ADD revision INT UNSIGNED NOT NULL DEFAULT 0,
 ADD CONSTRAINT fk_alerta_orientacion FOREIGN KEY (orientacion_id) REFERENCES orientaciones_guardadas(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD UNIQUE KEY uk_alerta_orientacion (orientacion_id,regla_aviso,version_politica),
 ADD CONSTRAINT ck_alerta_origen CHECK ((resultado_indicador_id IS NOT NULL AND orientacion_id IS NULL) OR (resultado_indicador_id IS NULL AND orientacion_id IS NOT NULL));
