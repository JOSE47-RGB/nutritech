CREATE TABLE IF NOT EXISTS orientaciones_guardadas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo_publico CHAR(26) NOT NULL,
  evaluacion_id BIGINT UNSIGNED NOT NULL,
  guardado_por BIGINT UNSIGNED NOT NULL,
  guardado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  contenido_sha256 CHAR(64) NOT NULL,
  contenido LONGTEXT NOT NULL CHECK (JSON_VALID(contenido)),
  PRIMARY KEY (id),
  UNIQUE KEY uk_orientacion_codigo (codigo_publico),
  UNIQUE KEY uk_orientacion_contenido (evaluacion_id, contenido_sha256),
  CONSTRAINT fk_orientacion_evaluacion FOREIGN KEY (evaluacion_id) REFERENCES evaluaciones_nutricionales(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orientacion_autor FOREIGN KEY (guardado_por) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
