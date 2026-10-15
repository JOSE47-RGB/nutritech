CREATE TABLE IF NOT EXISTS valoraciones_medicas (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 codigo_publico CHAR(26) NOT NULL UNIQUE,
 orientacion_id BIGINT UNSIGNED NOT NULL,
 medico_id BIGINT UNSIGNED NOT NULL,
 solicitud_id CHAR(36) NOT NULL,
 decision VARCHAR(30) NOT NULL CHECK (decision IN ('COINCIDE','DIFIERE','REQUIERE_INFORMACION')),
 valoracion TEXT NOT NULL,
 acciones TEXT NOT NULL,
 registrado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uk_valoracion_solicitud (orientacion_id,medico_id,solicitud_id),
 CONSTRAINT fk_valoracion_orientacion FOREIGN KEY (orientacion_id) REFERENCES orientaciones_guardadas(id) ON DELETE RESTRICT,
 CONSTRAINT fk_valoracion_medico FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
INSERT IGNORE INTO permisos (codigo,modulo,descripcion) VALUES ('evaluaciones.valorar','evaluaciones','Registrar valoración médica de una orientación guardada.');
INSERT IGNORE INTO rol_permiso (rol_id,permiso_id) SELECT r.id,p.id FROM roles r CROSS JOIN permisos p WHERE r.codigo='MEDICO' AND p.codigo='evaluaciones.valorar';
