ALTER TABLE reportes_generados
 MODIFY formato ENUM('PDF','CSV','XLSX','HTML') NOT NULL DEFAULT 'PDF',
 ADD orientacion_id BIGINT UNSIGNED NULL,
 ADD solicitud_id CHAR(36) NULL,
 ADD contenido_html LONGTEXT NULL,
 ADD UNIQUE KEY uk_reporte_solicitud (generado_por,solicitud_id),
 ADD CONSTRAINT fk_reporte_orientacion FOREIGN KEY (orientacion_id) REFERENCES orientaciones_guardadas(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
