-- Ejecutar en la base nutritech. No modifica tablas ni registros.
-- Prisma escribe DateTime en UTC; comparar vigencias con UTC independientemente
-- de la zona horaria de la conexión MariaDB. Puede ejecutarse nuevamente.
CREATE OR REPLACE VIEW vw_permisos_usuario AS
SELECT DISTINCT
    u.id AS usuario_id,
    p.id AS permiso_id,
    p.codigo AS permiso_codigo
FROM usuarios u
JOIN usuario_rol ur ON ur.usuario_id = u.id
JOIN roles r ON r.id = ur.rol_id AND r.activo = TRUE
JOIN rol_permiso rp ON rp.rol_id = r.id
JOIN permisos p ON p.id = rp.permiso_id AND p.activo = TRUE
WHERE u.estado = 'ACTIVO'
  AND NOT EXISTS (
      SELECT 1
      FROM usuario_permiso up
      WHERE up.usuario_id = u.id
        AND up.permiso_id = p.id
        AND up.efecto = 'DENEGAR'
        AND (up.expira_en IS NULL OR up.expira_en > UTC_TIMESTAMP(3))
  )
UNION
SELECT
    u.id AS usuario_id,
    p.id AS permiso_id,
    p.codigo AS permiso_codigo
FROM usuario_permiso up
JOIN usuarios u ON u.id = up.usuario_id AND u.estado = 'ACTIVO'
JOIN permisos p ON p.id = up.permiso_id AND p.activo = TRUE
WHERE up.efecto = 'PERMITIR'
  AND (up.expira_en IS NULL OR up.expira_en > UTC_TIMESTAMP(3));
