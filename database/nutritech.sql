/*
===============================================================================
 NUTRITECH - Esquema de base de datos para MariaDB 10.11+ / phpMyAdmin
 Proyecto: Sistema web para el seguimiento nutricional infantil
 Autor del proyecto: Jose Emanuel Perez de León
 Diseño: modelo relacional normalizado (3FN)
 Fecha: 2026-09-03

 ALCANCE ACTUAL CONFIRMADO EN EL DOCUMENTO
 - Aplicación web; no utiliza ESP32, sensores ni captura IoT.
 - Registro manual de niños, peso y talla.
 - Identificación única mediante certificado de nacimiento.
 - Autenticación, roles, permisos y menús dinámicos.
 - Historial nutricional, indicadores, alertas, dashboard y reportes PDF.
 - Auditoría y registro de respaldos.

 DECISIONES IMPORTANTES
 1. El historial nutricional NO es una tabla duplicada: se obtiene de las
    evaluaciones y sus resultados.
 2. El dashboard y las gráficas NO almacenan copias: consultan vistas/tablas.
 3. Un reporte PDF guarda solo metadatos; los datos se consultan desde el
    historial para evitar redundancia.
 4. Las evaluaciones clínicas no se eliminan ni sobrescriben. Si existe un
    error, se anulan y se registra una nueva evaluación que la reemplaza.
 5. NUTRITECH genera avisos de posible riesgo; no realiza diagnósticos médicos.
 6. El número del certificado no se guarda en texto plano. Laravel debe:
      a) normalizarlo;
      b) calcular un HMAC-SHA-256 y guardar los 32 bytes en certificado_hash;
      c) cifrar el valor original y guardarlo en certificado_cifrado;
      d) guardar únicamente sus últimos cuatro caracteres para mostrarlo.
 7. Todas las fechas DATETIME deben manejarse en UTC desde la aplicación.
 8. El menú se obtiene desde MariaDB según los permisos efectivos del usuario;
    Laravel no debe mantener listas duplicadas de opciones por cada rol.
 9. Los permisos pueden provenir de un rol o asignarse directamente a un
    usuario. Una denegación directa siempre prevalece sobre el permiso del rol.

 IMPORTACIÓN EN PHPMYADMIN
 - Use la pestaña Importar y seleccione este archivo completo.
 - El script crea y selecciona la base nutritech.
 - Las tablas usan IF NOT EXISTS para poder continuar una importación previa
   que se haya detenido antes de completar el esquema.
 - Si el servidor no permite CREATE DATABASE, cree nutritech desde phpMyAdmin,
   selecciónela y comente las instrucciones CREATE DATABASE y USE.
===============================================================================
*/

CREATE DATABASE IF NOT EXISTS nutritech
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE nutritech;

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------------------------------------------------------------------------
-- 1. ORGANIZACIÓN Y UBICACIÓN
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS centros_salud (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo              VARCHAR(30) NOT NULL,
    nombre              VARCHAR(150) NOT NULL,
    tipo                ENUM('CAP','PUESTO_SALUD','CENTRO_SALUD','OTRO') NOT NULL DEFAULT 'CAP',
    departamento        VARCHAR(100) NOT NULL DEFAULT 'Quetzaltenango',
    municipio           VARCHAR(100) NOT NULL DEFAULT 'Génova Costa Cuca',
    direccion           VARCHAR(255) NULL,
    telefono            VARCHAR(25) NULL,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    actualizado_en      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_centros_codigo (codigo),
    KEY ix_centros_ubicacion (departamento, municipio),
    CONSTRAINT ck_centros_nombre CHECK (CHAR_LENGTH(TRIM(nombre)) >= 3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS comunidades (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre              VARCHAR(120) NOT NULL,
    municipio           VARCHAR(100) NOT NULL DEFAULT 'Génova Costa Cuca',
    departamento        VARCHAR(100) NOT NULL DEFAULT 'Quetzaltenango',
    zona_referencia     VARCHAR(150) NULL,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_comunidad_ubicacion (departamento, municipio, nombre)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 2. SEGURIDAD: USUARIOS, ROLES, PERMISOS, SESIONES Y MENÚS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
    id                  SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo              VARCHAR(40) NOT NULL,
    nombre              VARCHAR(80) NOT NULL,
    descripcion         VARCHAR(255) NULL,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_roles_codigo (codigo),
    UNIQUE KEY uk_roles_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS permisos (
    id                  SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo              VARCHAR(80) NOT NULL,
    modulo              VARCHAR(50) NOT NULL,
    descripcion         VARCHAR(255) NOT NULL,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    actualizado_en      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_permisos_codigo (codigo),
    KEY ix_permisos_modulo (modulo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rol_permiso (
    rol_id              SMALLINT UNSIGNED NOT NULL,
    permiso_id          SMALLINT UNSIGNED NOT NULL,
    asignado_en         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (rol_id, permiso_id),
    CONSTRAINT fk_rol_permiso_rol
        FOREIGN KEY (rol_id) REFERENCES roles(id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_rol_permiso_permiso
        FOREIGN KEY (permiso_id) REFERENCES permisos(id)
        ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo_publico      CHAR(26) NOT NULL COMMENT 'ULID generado por Laravel',
    centro_salud_id     BIGINT UNSIGNED NULL,
    codigo_acceso       VARCHAR(40) NOT NULL COMMENT 'Código de médico o código institucional',
    nombres             VARCHAR(120) NOT NULL,
    apellidos           VARCHAR(120) NOT NULL,
    numero_colegiado    VARCHAR(40) NULL,
    correo              VARCHAR(160) NULL,
    contrasena_hash     VARCHAR(255) NOT NULL COMMENT 'Hash Argon2id o bcrypt; nunca texto plano',
    estado              ENUM('ACTIVO','BLOQUEADO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    intentos_fallidos   TINYINT UNSIGNED NOT NULL DEFAULT 0,
    bloqueado_hasta     DATETIME(3) NULL,
    ultimo_acceso_en    DATETIME(3) NULL,
    creado_por          BIGINT UNSIGNED NULL,
    creado_en           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    actualizado_en      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        ON UPDATE CURRENT_TIMESTAMP(3),
    desactivado_en      DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_usuarios_codigo_publico (codigo_publico),
    UNIQUE KEY uk_usuarios_codigo_acceso (codigo_acceso),
    UNIQUE KEY uk_usuarios_correo (correo),
    KEY ix_usuarios_centro_estado (centro_salud_id, estado),
    KEY ix_usuarios_nombre (apellidos, nombres),
    CONSTRAINT fk_usuarios_centro
        FOREIGN KEY (centro_salud_id) REFERENCES centros_salud(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_usuarios_creador
        FOREIGN KEY (creado_por) REFERENCES usuarios(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_usuarios_codigo_acceso CHECK (CHAR_LENGTH(TRIM(codigo_acceso)) >= 3),
    CONSTRAINT ck_usuarios_intentos CHECK (intentos_fallidos <= 20)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuario_rol (
    usuario_id          BIGINT UNSIGNED NOT NULL,
    rol_id              SMALLINT UNSIGNED NOT NULL,
    asignado_por        BIGINT UNSIGNED NULL,
    asignado_en         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (usuario_id, rol_id),
    CONSTRAINT fk_usuario_rol_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_usuario_rol_rol
        FOREIGN KEY (rol_id) REFERENCES roles(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_usuario_rol_asignador
        FOREIGN KEY (asignado_por) REFERENCES usuarios(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Permisos particulares por usuario. PERMITIR agrega una capacidad que el rol
-- no posee; DENEGAR la retira aunque el rol sí la tenga. Esto permite cambiar
-- un menú individual sin modificar el backend ni crear un nuevo rol.
CREATE TABLE IF NOT EXISTS usuario_permiso (
    usuario_id          BIGINT UNSIGNED NOT NULL,
    permiso_id          SMALLINT UNSIGNED NOT NULL,
    efecto              ENUM('PERMITIR','DENEGAR') NOT NULL,
    asignado_por        BIGINT UNSIGNED NOT NULL,
    motivo              VARCHAR(255) NULL,
    asignado_en         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expira_en           DATETIME(3) NULL,
    PRIMARY KEY (usuario_id, permiso_id),
    KEY ix_usuario_permiso_vigencia (efecto, expira_en),
    CONSTRAINT fk_usuario_permiso_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_usuario_permiso_permiso
        FOREIGN KEY (permiso_id) REFERENCES permisos(id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_usuario_permiso_asignador
        FOREIGN KEY (asignado_por) REFERENCES usuarios(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_usuario_permiso_expira CHECK (expira_en IS NULL OR expira_en > asignado_en)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sesiones_usuario (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id          BIGINT UNSIGNED NOT NULL,
    token_hash          BINARY(32) NOT NULL COMMENT 'SHA-256 del token; no guardar el token original',
    direccion_ip        VARBINARY(16) NULL COMMENT 'IPv4 o IPv6 con INET6_ATON()',
    agente_usuario      VARCHAR(500) NULL,
    iniciada_en         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expira_en           DATETIME(3) NOT NULL,
    revocada_en         DATETIME(3) NULL,
    motivo_revocacion   VARCHAR(120) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_sesiones_token_hash (token_hash),
    KEY ix_sesiones_usuario_vigencia (usuario_id, expira_en, revocada_en),
    CONSTRAINT fk_sesiones_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT ck_sesiones_expira CHECK (expira_en > iniciada_en)
) ENGINE=InnoDB;

-- Los módulos representan las secciones principales del menú lateral.
CREATE TABLE IF NOT EXISTS modulos_menu (
    id                  SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo              VARCHAR(50) NOT NULL,
    nombre              VARCHAR(100) NOT NULL,
    descripcion         VARCHAR(255) NULL,
    icono               VARCHAR(80) NULL COMMENT 'Nombre del icono usado por la interfaz',
    ruta_base           VARCHAR(180) NULL,
    orden               SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    actualizado_en      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_modulos_menu_codigo (codigo),
    KEY ix_modulos_menu_orden (activo, orden, nombre)
) ENGINE=InnoDB;

-- Una opción puede ser un enlace, un grupo desplegable o un separador visual.
-- menu_padre_id permite crear submenús de cualquier profundidad.
CREATE TABLE IF NOT EXISTS opciones_menu (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    modulo_menu_id          SMALLINT UNSIGNED NOT NULL,
    menu_padre_id           BIGINT UNSIGNED NULL,
    codigo                  VARCHAR(70) NOT NULL,
    nombre                  VARCHAR(120) NOT NULL,
    tipo                    ENUM('ENLACE','GRUPO','SEPARADOR') NOT NULL DEFAULT 'ENLACE',
    ruta                    VARCHAR(220) NULL COMMENT 'Ruta del frontend o nombre de ruta Laravel',
    icono                   VARCHAR(80) NULL,
    orden                   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    visible                 BOOLEAN NOT NULL DEFAULT TRUE,
    activo                  BOOLEAN NOT NULL DEFAULT TRUE,
    abre_nueva_pestana      BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    actualizado_en          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                            ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_opciones_menu_codigo (codigo),
    KEY ix_opciones_menu_modulo (modulo_menu_id, activo, visible, orden),
    KEY ix_opciones_menu_padre (menu_padre_id, activo, orden),
    CONSTRAINT fk_opciones_menu_modulo
        FOREIGN KEY (modulo_menu_id) REFERENCES modulos_menu(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_opciones_menu_padre
        FOREIGN KEY (menu_padre_id) REFERENCES opciones_menu(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_opciones_menu_tipo_ruta CHECK (
        (tipo = 'ENLACE' AND ruta IS NOT NULL)
        OR (tipo IN ('GRUPO','SEPARADOR') AND ruta IS NULL)
    )
) ENGINE=InnoDB;

-- MariaDB no permite usar el id AUTO_INCREMENT dentro de un CHECK. La regla
-- menu_padre_id <> id se valida al crear o editar el menú desde el backend.

-- No se enlaza el menú directamente con usuarios ni roles. Se enlaza con
-- permisos para mantener una única fuente de autorización.
CREATE TABLE IF NOT EXISTS opcion_menu_permiso (
    opcion_menu_id      BIGINT UNSIGNED NOT NULL,
    permiso_id          SMALLINT UNSIGNED NOT NULL,
    asignado_en         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (opcion_menu_id, permiso_id),
    CONSTRAINT fk_opcion_menu_permiso_opcion
        FOREIGN KEY (opcion_menu_id) REFERENCES opciones_menu(id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_opcion_menu_permiso_permiso
        FOREIGN KEY (permiso_id) REFERENCES permisos(id)
        ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 3. NIÑOS Y RESPONSABLES FAMILIARES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ninos (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo_publico          CHAR(26) NOT NULL COMMENT 'ULID visible en API y URL',
    codigo_expediente       VARCHAR(40) NOT NULL,
    comunidad_id            BIGINT UNSIGNED NULL,
    certificado_hash        BINARY(32) NOT NULL COMMENT 'HMAC-SHA-256 para validar duplicados',
    certificado_cifrado     VARBINARY(512) NOT NULL COMMENT 'Certificado cifrado por Laravel',
    certificado_ultimos4    CHAR(4) NOT NULL,
    primer_nombre           VARCHAR(80) NOT NULL,
    segundo_nombre          VARCHAR(80) NULL,
    primer_apellido         VARCHAR(80) NOT NULL,
    segundo_apellido        VARCHAR(80) NULL,
    fecha_nacimiento        DATE NOT NULL,
    sexo_biologico          ENUM('M','F') NOT NULL COMMENT 'Dato requerido por patrones de crecimiento',
    direccion_referencia    VARCHAR(255) NULL,
    estado                  ENUM('ACTIVO','INACTIVO','ARCHIVADO') NOT NULL DEFAULT 'ACTIVO',
    registrado_por          BIGINT UNSIGNED NOT NULL,
    creado_en               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    actualizado_en          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                            ON UPDATE CURRENT_TIMESTAMP(3),
    archivado_en            DATETIME(3) NULL,
    version_registro        INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Control de concurrencia optimista',
    PRIMARY KEY (id),
    UNIQUE KEY uk_ninos_codigo_publico (codigo_publico),
    UNIQUE KEY uk_ninos_expediente (codigo_expediente),
    UNIQUE KEY uk_ninos_certificado_hash (certificado_hash),
    KEY ix_ninos_nombre (primer_apellido, segundo_apellido, primer_nombre, segundo_nombre),
    KEY ix_ninos_fecha_sexo (fecha_nacimiento, sexo_biologico),
    KEY ix_ninos_comunidad_estado (comunidad_id, estado),
    CONSTRAINT fk_ninos_comunidad
        FOREIGN KEY (comunidad_id) REFERENCES comunidades(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_ninos_registrador
        FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_ninos_primer_nombre CHECK (CHAR_LENGTH(TRIM(primer_nombre)) >= 2),
    CONSTRAINT ck_ninos_primer_apellido CHECK (CHAR_LENGTH(TRIM(primer_apellido)) >= 2),
    CONSTRAINT ck_ninos_certificado_ultimos4
        CHECK (certificado_ultimos4 REGEXP '^[[:alnum:]]{4}$'),
    CONSTRAINT ck_ninos_version CHECK (version_registro >= 1)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS responsables (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo_publico          CHAR(26) NOT NULL,
    nombres                 VARCHAR(120) NOT NULL,
    apellidos               VARCHAR(120) NOT NULL,
    telefono                VARCHAR(25) NULL,
    correo                  VARCHAR(160) NULL,
    direccion               VARCHAR(255) NULL,
    activo                  BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    actualizado_en          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                            ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_responsables_codigo_publico (codigo_publico),
    KEY ix_responsables_nombre (apellidos, nombres),
    KEY ix_responsables_telefono (telefono)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nino_responsable (
    nino_id                 BIGINT UNSIGNED NOT NULL,
    responsable_id          BIGINT UNSIGNED NOT NULL,
    parentesco              ENUM('MADRE','PADRE','TUTOR','ABUELO_A','OTRO') NOT NULL,
    es_principal            BOOLEAN NOT NULL DEFAULT FALSE,
    autorizado_contacto     BOOLEAN NOT NULL DEFAULT TRUE,
    registrado_por          BIGINT UNSIGNED NOT NULL,
    creado_en               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (nino_id, responsable_id),
    KEY ix_nino_responsable_principal (nino_id, es_principal),
    CONSTRAINT fk_nino_responsable_nino
        FOREIGN KEY (nino_id) REFERENCES ninos(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_nino_responsable_persona
        FOREIGN KEY (responsable_id) REFERENCES responsables(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_nino_responsable_usuario
        FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 4. EVALUACIONES NUTRICIONALES (DATOS FUENTE DEL HISTORIAL)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS evaluaciones_nutricionales (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo_publico          CHAR(26) NOT NULL,
    nino_id                 BIGINT UNSIGNED NOT NULL,
    centro_salud_id         BIGINT UNSIGNED NOT NULL,
    registrado_por          BIGINT UNSIGNED NOT NULL,
    reemplaza_evaluacion_id BIGINT UNSIGNED NULL COMMENT 'Evaluación anulada que esta corrige',
    evaluado_en             DATETIME(3) NOT NULL,
    edad_dias               SMALLINT UNSIGNED NOT NULL COMMENT 'Edad exacta al momento de la evaluación',
    peso_kg                 DECIMAL(5,2) NOT NULL,
    talla_cm                DECIMAL(5,2) NOT NULL,
    tipo_medicion           ENUM('LONGITUD_ACOSTADO','TALLA_DE_PIE') NOT NULL,
    imc                     DECIMAL(5,2)
                            GENERATED ALWAYS AS
                            (ROUND(peso_kg / POW(talla_cm / 100, 2), 2)) STORED,
    lugar_evaluacion        ENUM('CLINICA','VISITA_DOMICILIAR','JORNADA_COMUNITARIA','OTRO')
                            NOT NULL DEFAULT 'CLINICA',
    origen_registro         ENUM('MANUAL_WEB','IMPORTACION_AUTORIZADA')
                            NOT NULL DEFAULT 'MANUAL_WEB',
    observaciones           TEXT NULL,
    estado                  ENUM('REGISTRADA','VALIDADA','ANULADA') NOT NULL DEFAULT 'REGISTRADA',
    anulada_por             BIGINT UNSIGNED NULL,
    anulada_en              DATETIME(3) NULL,
    motivo_anulacion        VARCHAR(500) NULL,
    creado_en               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    actualizado_en          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                            ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_evaluaciones_codigo_publico (codigo_publico),
    UNIQUE KEY uk_evaluacion_reemplazada (reemplaza_evaluacion_id),
    KEY ix_evaluaciones_historial (nino_id, evaluado_en DESC),
    KEY ix_evaluaciones_centro_fecha (centro_salud_id, evaluado_en DESC),
    KEY ix_evaluaciones_usuario_fecha (registrado_por, evaluado_en DESC),
    KEY ix_evaluaciones_estado_fecha (estado, evaluado_en DESC),
    CONSTRAINT fk_evaluaciones_nino
        FOREIGN KEY (nino_id) REFERENCES ninos(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_evaluaciones_centro
        FOREIGN KEY (centro_salud_id) REFERENCES centros_salud(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_evaluaciones_registrador
        FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_evaluaciones_reemplazo
        FOREIGN KEY (reemplaza_evaluacion_id) REFERENCES evaluaciones_nutricionales(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_evaluaciones_anulador
        FOREIGN KEY (anulada_por) REFERENCES usuarios(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_evaluaciones_edad CHECK (edad_dias <= 2200),
    CONSTRAINT ck_evaluaciones_peso CHECK (peso_kg BETWEEN 0.30 AND 100.00),
    CONSTRAINT ck_evaluaciones_talla CHECK (talla_cm BETWEEN 30.00 AND 150.00),
    CONSTRAINT ck_evaluaciones_anulacion CHECK (
        (estado <> 'ANULADA' AND anulada_por IS NULL AND anulada_en IS NULL AND motivo_anulacion IS NULL)
        OR
        (estado = 'ANULADA' AND anulada_por IS NOT NULL AND anulada_en IS NOT NULL
         AND motivo_anulacion IS NOT NULL)
    )
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 5. PATRONES, PARÁMETROS Y RESULTADOS DE INDICADORES
-- No cargar valores clínicos improvisados. Los parámetros LMS y las reglas
-- deben importarse desde una fuente oficial, revisarse por un profesional de
-- salud y quedar asociados a una versión del patrón.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS patrones_crecimiento (
    id                      SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo                  VARCHAR(40) NOT NULL,
    nombre                  VARCHAR(160) NOT NULL,
    organizacion_fuente     VARCHAR(120) NOT NULL,
    version                 VARCHAR(40) NOT NULL,
    referencia_documental  VARCHAR(500) NULL,
    vigente_desde           DATE NULL,
    vigente_hasta           DATE NULL,
    activo                  BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_patrones_codigo (codigo),
    UNIQUE KEY uk_patrones_nombre_version (nombre, version),
    CONSTRAINT ck_patrones_vigencia
        CHECK (vigente_hasta IS NULL OR vigente_desde IS NULL OR vigente_hasta >= vigente_desde)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tipos_indicador (
    id                      SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo                  VARCHAR(30) NOT NULL,
    nombre                  VARCHAR(120) NOT NULL,
    eje_referencia          ENUM('EDAD_DIAS','TALLA_CM') NOT NULL,
    variable_resultado      ENUM('PESO_KG','TALLA_CM','IMC') NOT NULL,
    unidad_resultado        VARCHAR(20) NOT NULL,
    descripcion             VARCHAR(255) NULL,
    activo                  BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uk_indicadores_codigo (codigo),
    UNIQUE KEY uk_indicadores_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS parametros_lms_edad (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    patron_id               SMALLINT UNSIGNED NOT NULL,
    indicador_id            SMALLINT UNSIGNED NOT NULL,
    sexo_biologico          ENUM('M','F') NOT NULL,
    edad_dias               SMALLINT UNSIGNED NOT NULL,
    valor_l                 DECIMAL(14,8) NOT NULL,
    valor_m                 DECIMAL(14,8) NOT NULL,
    valor_s                 DECIMAL(14,8) NOT NULL,
    creado_en               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_lms_edad (patron_id, indicador_id, sexo_biologico, edad_dias),
    CONSTRAINT fk_lms_edad_patron
        FOREIGN KEY (patron_id) REFERENCES patrones_crecimiento(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_lms_edad_indicador
        FOREIGN KEY (indicador_id) REFERENCES tipos_indicador(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_lms_edad_m CHECK (valor_m > 0),
    CONSTRAINT ck_lms_edad_s CHECK (valor_s > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS parametros_lms_talla (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    patron_id               SMALLINT UNSIGNED NOT NULL,
    indicador_id            SMALLINT UNSIGNED NOT NULL,
    sexo_biologico          ENUM('M','F') NOT NULL,
    tipo_medicion           ENUM('LONGITUD_ACOSTADO','TALLA_DE_PIE') NOT NULL,
    talla_cm                DECIMAL(5,1) NOT NULL,
    valor_l                 DECIMAL(14,8) NOT NULL,
    valor_m                 DECIMAL(14,8) NOT NULL,
    valor_s                 DECIMAL(14,8) NOT NULL,
    creado_en               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_lms_talla
        (patron_id, indicador_id, sexo_biologico, tipo_medicion, talla_cm),
    CONSTRAINT fk_lms_talla_patron
        FOREIGN KEY (patron_id) REFERENCES patrones_crecimiento(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_lms_talla_indicador
        FOREIGN KEY (indicador_id) REFERENCES tipos_indicador(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_lms_talla_rango CHECK (talla_cm BETWEEN 30.0 AND 150.0),
    CONSTRAINT ck_lms_talla_m CHECK (valor_m > 0),
    CONSTRAINT ck_lms_talla_s CHECK (valor_s > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reglas_clasificacion (
    id                      SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    patron_id               SMALLINT UNSIGNED NOT NULL,
    indicador_id            SMALLINT UNSIGNED NOT NULL,
    codigo                  VARCHAR(50) NOT NULL,
    etiqueta                VARCHAR(140) NOT NULL,
    z_min                   DECIMAL(6,3) NULL,
    z_max                   DECIMAL(6,3) NULL,
    incluye_min             BOOLEAN NOT NULL DEFAULT TRUE,
    incluye_max             BOOLEAN NOT NULL DEFAULT FALSE,
    nivel_revision          ENUM('NINGUNO','OBSERVAR','PRIORITARIO','URGENTE') NOT NULL,
    color_hex               CHAR(7) NOT NULL,
    genera_alerta           BOOLEAN NOT NULL DEFAULT FALSE,
    orden                   TINYINT UNSIGNED NOT NULL,
    activa                  BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uk_regla_codigo (patron_id, indicador_id, codigo),
    KEY ix_reglas_busqueda (patron_id, indicador_id, activa, orden),
    CONSTRAINT fk_reglas_patron
        FOREIGN KEY (patron_id) REFERENCES patrones_crecimiento(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_reglas_indicador
        FOREIGN KEY (indicador_id) REFERENCES tipos_indicador(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_reglas_rango_z CHECK (z_min IS NULL OR z_max IS NULL OR z_min < z_max),
    CONSTRAINT ck_reglas_color CHECK (color_hex REGEXP '^#[0-9A-Fa-f]{6}$')
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS resultados_indicador (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    evaluacion_id           BIGINT UNSIGNED NOT NULL,
    patron_id               SMALLINT UNSIGNED NOT NULL,
    indicador_id            SMALLINT UNSIGNED NOT NULL,
    regla_clasificacion_id  SMALLINT UNSIGNED NULL,
    valor_observado         DECIMAL(12,4) NOT NULL,
    puntaje_z               DECIMAL(7,4) NULL,
    percentil               DECIMAL(7,4) NULL,
    clasificacion_texto     VARCHAR(140) NOT NULL,
    nivel_revision          ENUM('NINGUNO','OBSERVAR','PRIORITARIO','URGENTE') NOT NULL,
    requiere_revision       BOOLEAN NOT NULL DEFAULT FALSE,
    version_algoritmo       VARCHAR(40) NOT NULL,
    detalles_calculo        JSON NULL,
    calculado_en            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_resultado_evaluacion_indicador (evaluacion_id, indicador_id),
    KEY ix_resultados_clasificacion (indicador_id, nivel_revision, calculado_en DESC),
    CONSTRAINT fk_resultados_evaluacion
        FOREIGN KEY (evaluacion_id) REFERENCES evaluaciones_nutricionales(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_resultados_patron
        FOREIGN KEY (patron_id) REFERENCES patrones_crecimiento(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_resultados_indicador
        FOREIGN KEY (indicador_id) REFERENCES tipos_indicador(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_resultados_regla
        FOREIGN KEY (regla_clasificacion_id) REFERENCES reglas_clasificacion(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_resultados_percentil CHECK (percentil IS NULL OR percentil BETWEEN 0 AND 100)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 6. ALERTAS Y SU TRAZABILIDAD
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS alertas (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo_publico          CHAR(26) NOT NULL,
    resultado_indicador_id  BIGINT UNSIGNED NOT NULL,
    nivel                   ENUM('OBSERVAR','PRIORITARIO','URGENTE') NOT NULL,
    titulo                  VARCHAR(160) NOT NULL,
    mensaje                 VARCHAR(600) NOT NULL,
    estado                  ENUM('PENDIENTE','EN_REVISION','ATENDIDA','DESCARTADA')
                            NOT NULL DEFAULT 'PENDIENTE',
    generada_en             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    asignada_a              BIGINT UNSIGNED NULL,
    revisada_por            BIGINT UNSIGNED NULL,
    revisada_en             DATETIME(3) NULL,
    observacion_revision    TEXT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_alertas_codigo_publico (codigo_publico),
    UNIQUE KEY uk_alerta_por_resultado (resultado_indicador_id),
    KEY ix_alertas_bandeja (estado, nivel, generada_en DESC),
    KEY ix_alertas_asignada (asignada_a, estado, generada_en DESC),
    CONSTRAINT fk_alertas_resultado
        FOREIGN KEY (resultado_indicador_id) REFERENCES resultados_indicador(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_alertas_asignada
        FOREIGN KEY (asignada_a) REFERENCES usuarios(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_alertas_revisor
        FOREIGN KEY (revisada_por) REFERENCES usuarios(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_alertas_revision CHECK (
        (estado IN ('PENDIENTE','EN_REVISION') AND revisada_en IS NULL)
        OR
        (estado IN ('ATENDIDA','DESCARTADA') AND revisada_por IS NOT NULL AND revisada_en IS NOT NULL)
    )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS historial_alerta (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    alerta_id               BIGINT UNSIGNED NOT NULL,
    estado_anterior         ENUM('PENDIENTE','EN_REVISION','ATENDIDA','DESCARTADA') NULL,
    estado_nuevo            ENUM('PENDIENTE','EN_REVISION','ATENDIDA','DESCARTADA') NOT NULL,
    cambiado_por            BIGINT UNSIGNED NULL COMMENT 'NULL cuando el cambio lo realiza el sistema',
    comentario              VARCHAR(600) NULL,
    cambiado_en             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY ix_historial_alerta_fecha (alerta_id, cambiado_en),
    CONSTRAINT fk_historial_alerta
        FOREIGN KEY (alerta_id) REFERENCES alertas(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_historial_alerta_usuario
        FOREIGN KEY (cambiado_por) REFERENCES usuarios(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_historial_alerta_cambio
        CHECK (estado_anterior IS NULL OR estado_anterior <> estado_nuevo)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 7. REPORTES, AUDITORÍA Y RESPALDOS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reportes_generados (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo_publico          CHAR(26) NOT NULL,
    tipo_reporte            VARCHAR(60) NOT NULL,
    nino_id                 BIGINT UNSIGNED NULL,
    filtros                 JSON NULL,
    formato                 ENUM('PDF','CSV','XLSX') NOT NULL DEFAULT 'PDF',
    ruta_archivo            VARCHAR(500) NULL COMMENT 'Ruta privada; nunca URL pública permanente',
    hash_sha256             BINARY(32) NULL,
    total_registros         INT UNSIGNED NOT NULL DEFAULT 0,
    generado_por            BIGINT UNSIGNED NOT NULL,
    generado_en             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expira_en               DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_reportes_codigo_publico (codigo_publico),
    KEY ix_reportes_usuario_fecha (generado_por, generado_en DESC),
    KEY ix_reportes_nino_fecha (nino_id, generado_en DESC),
    CONSTRAINT fk_reportes_nino
        FOREIGN KEY (nino_id) REFERENCES ninos(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_reportes_usuario
        FOREIGN KEY (generado_por) REFERENCES usuarios(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_reportes_expira CHECK (expira_en IS NULL OR expira_en > generado_en)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS registros_auditoria (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id              BIGINT UNSIGNED NULL COMMENT 'NULL para procesos automáticos',
    accion                  ENUM('INSERTAR','ACTUALIZAR','ANULAR','INICIAR_SESION',
                                 'CERRAR_SESION','CONSULTAR','EXPORTAR','RESPALDAR') NOT NULL,
    entidad                 VARCHAR(80) NOT NULL,
    entidad_id              VARCHAR(64) NULL,
    datos_anteriores        JSON NULL,
    datos_nuevos            JSON NULL,
    direccion_ip            VARBINARY(16) NULL,
    agente_usuario          VARCHAR(500) NULL,
    correlacion_solicitud   CHAR(36) NULL COMMENT 'UUID de la solicitud API',
    ocurrido_en             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY ix_auditoria_entidad (entidad, entidad_id, ocurrido_en DESC),
    KEY ix_auditoria_usuario (usuario_id, ocurrido_en DESC),
    KEY ix_auditoria_fecha (ocurrido_en DESC),
    CONSTRAINT fk_auditoria_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='No registrar contraseñas, tokens ni certificados descifrados';

CREATE TABLE IF NOT EXISTS respaldos_bd (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tipo                    ENUM('COMPLETO','INCREMENTAL') NOT NULL DEFAULT 'COMPLETO',
    destino                 VARCHAR(255) NOT NULL COMMENT 'Identificador o ruta privada del respaldo',
    estado                  ENUM('INICIADO','COMPLETADO','FALLIDO','VERIFICADO') NOT NULL,
    tamano_bytes            BIGINT UNSIGNED NULL,
    hash_sha256             BINARY(32) NULL,
    iniciado_en             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    finalizado_en           DATETIME(3) NULL,
    verificado_en           DATETIME(3) NULL,
    registrado_por          BIGINT UNSIGNED NULL,
    detalle_error           VARCHAR(1000) NULL,
    PRIMARY KEY (id),
    KEY ix_respaldos_estado_fecha (estado, iniciado_en DESC),
    CONSTRAINT fk_respaldos_usuario
        FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_respaldos_finalizacion
        CHECK (finalizado_en IS NULL OR finalizado_en >= iniciado_en),
    CONSTRAINT ck_respaldos_verificacion
        CHECK (verificado_en IS NULL OR estado = 'VERIFICADO')
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 8. VISTAS PARA HISTORIAL, ALERTAS, DASHBOARD Y MENÚ DINÁMICO
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_historial_nutricional AS
SELECT
    n.codigo_publico AS nino_codigo,
    n.codigo_expediente,
    CONCAT_WS(' ', n.primer_nombre, n.segundo_nombre,
                   n.primer_apellido, n.segundo_apellido) AS nombre_nino,
    n.fecha_nacimiento,
    n.sexo_biologico,
    e.codigo_publico AS evaluacion_codigo,
    e.evaluado_en,
    e.edad_dias,
    e.peso_kg,
    e.talla_cm,
    e.imc,
    e.tipo_medicion,
    e.lugar_evaluacion,
    e.estado AS estado_evaluacion,
    ti.codigo AS indicador_codigo,
    ti.nombre AS indicador,
    ri.puntaje_z,
    ri.percentil,
    ri.clasificacion_texto,
    ri.nivel_revision,
    ri.requiere_revision,
    pc.codigo AS patron_codigo,
    ri.version_algoritmo,
    CONCAT_WS(' ', u.nombres, u.apellidos) AS registrado_por
FROM ninos n
JOIN evaluaciones_nutricionales e ON e.nino_id = n.id
JOIN usuarios u ON u.id = e.registrado_por
LEFT JOIN resultados_indicador ri ON ri.evaluacion_id = e.id
LEFT JOIN tipos_indicador ti ON ti.id = ri.indicador_id
LEFT JOIN patrones_crecimiento pc ON pc.id = ri.patron_id
WHERE n.estado <> 'ARCHIVADO';

CREATE OR REPLACE VIEW vw_alertas_pendientes AS
SELECT
    a.codigo_publico AS alerta_codigo,
    a.nivel,
    a.estado,
    a.titulo,
    a.mensaje,
    a.generada_en,
    n.codigo_publico AS nino_codigo,
    n.codigo_expediente,
    CONCAT_WS(' ', n.primer_nombre, n.segundo_nombre,
                   n.primer_apellido, n.segundo_apellido) AS nombre_nino,
    e.evaluado_en,
    ti.codigo AS indicador_codigo,
    ri.puntaje_z,
    ri.clasificacion_texto,
    CONCAT_WS(' ', ua.nombres, ua.apellidos) AS asignada_a
FROM alertas a
JOIN resultados_indicador ri ON ri.id = a.resultado_indicador_id
JOIN tipos_indicador ti ON ti.id = ri.indicador_id
JOIN evaluaciones_nutricionales e ON e.id = ri.evaluacion_id
JOIN ninos n ON n.id = e.nino_id
LEFT JOIN usuarios ua ON ua.id = a.asignada_a
WHERE a.estado IN ('PENDIENTE','EN_REVISION')
  AND e.estado <> 'ANULADA';

CREATE OR REPLACE VIEW vw_dashboard_diario AS
SELECT
    e.centro_salud_id,
    DATE(e.evaluado_en) AS fecha,
    COUNT(DISTINCT e.id) AS total_evaluaciones,
    COUNT(DISTINCT e.nino_id) AS ninos_evaluados,
    COUNT(DISTINCT CASE WHEN ri.requiere_revision = TRUE THEN e.nino_id END)
        AS ninos_con_revision,
    COUNT(DISTINCT CASE WHEN a.estado = 'PENDIENTE' THEN a.id END)
        AS alertas_pendientes
FROM evaluaciones_nutricionales e
LEFT JOIN resultados_indicador ri ON ri.evaluacion_id = e.id
LEFT JOIN alertas a ON a.resultado_indicador_id = ri.id
WHERE e.estado <> 'ANULADA'
GROUP BY e.centro_salud_id, DATE(e.evaluado_en);

-- Combina permisos de roles con permisos directos. Una DENEGACIÓN directa
-- elimina el permiso concedido por cualquier rol.
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
        AND (up.expira_en IS NULL OR up.expira_en > CURRENT_TIMESTAMP(3))
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
  AND (up.expira_en IS NULL OR up.expira_en > CURRENT_TIMESTAMP(3));

-- Devuelve el menú efectivo de cada usuario. El DISTINCT asegura una sola
-- opción aunque varios permisos o roles conduzcan al mismo menú.
CREATE OR REPLACE VIEW vw_menu_usuario AS
SELECT DISTINCT
    u.id AS usuario_id,
    mm.id AS modulo_id,
    mm.codigo AS modulo_codigo,
    mm.nombre AS modulo_nombre,
    mm.icono AS modulo_icono,
    mm.ruta_base,
    mm.orden AS modulo_orden,
    om.id AS opcion_id,
    om.menu_padre_id,
    omp.codigo AS opcion_padre_codigo,
    om.codigo AS opcion_codigo,
    om.nombre AS opcion_nombre,
    om.tipo AS opcion_tipo,
    om.ruta,
    om.icono AS opcion_icono,
    om.orden AS opcion_orden,
    om.abre_nueva_pestana
FROM vw_permisos_usuario pu
JOIN usuarios u ON u.id = pu.usuario_id
JOIN opcion_menu_permiso op ON op.permiso_id = pu.permiso_id
JOIN opciones_menu om ON om.id = op.opcion_menu_id
    AND om.activo = TRUE AND om.visible = TRUE
JOIN modulos_menu mm ON mm.id = om.modulo_menu_id AND mm.activo = TRUE
LEFT JOIN opciones_menu omp ON omp.id = om.menu_padre_id
WHERE u.estado = 'ACTIVO';

-- ---------------------------------------------------------------------------
-- 9. CATÁLOGOS INICIALES
-- Las reglas clínicas y los parámetros LMS se cargan únicamente después de
-- validación por la institución o profesional de salud responsable.
-- ---------------------------------------------------------------------------

INSERT INTO centros_salud
    (codigo, nombre, tipo, departamento, municipio, activo)
VALUES
    ('CAP-GENOVA', 'Centro de Atención Permanente de Génova Costa Cuca',
     'CAP', 'Quetzaltenango', 'Génova Costa Cuca', TRUE)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), activo = VALUES(activo);

INSERT INTO roles (codigo, nombre, descripcion) VALUES
    ('ADMINISTRADOR', 'Administrador', 'Gestiona usuarios, permisos, catálogos y respaldos.'),
    ('MEDICO', 'Médico', 'Registra, consulta y revisa información nutricional autorizada.'),
    ('NUTRICIONISTA', 'Nutricionista', 'Evalúa el seguimiento nutricional y atiende alertas.'),
    ('USUARIO_NORMAL', 'Usuario normal',
     'Captura peso y altura, consulta alertas y genera reportes PDF para impresión.')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), descripcion = VALUES(descripcion);

INSERT INTO permisos (codigo, modulo, descripcion) VALUES
    ('dashboard.ver', 'dashboard', 'Consultar el panel principal del sistema.'),
    ('usuarios.ver', 'usuarios', 'Consultar usuarios autorizados.'),
    ('usuarios.gestionar', 'usuarios', 'Crear, actualizar, bloquear y desactivar usuarios.'),
    ('roles.gestionar', 'seguridad', 'Asignar roles y permisos.'),
    ('menus.ver', 'seguridad', 'Consultar la configuración de módulos y opciones del menú.'),
    ('menus.gestionar', 'seguridad', 'Crear, editar, ordenar y desactivar opciones del menú.'),
    ('ninos.ver', 'ninos', 'Consultar niños autorizados.'),
    ('ninos.buscar', 'ninos',
     'Buscar datos mínimos de un niño durante la captura, sin abrir el módulo de expedientes.'),
    ('ninos.crear', 'ninos', 'Registrar niños y validar duplicados.'),
    ('ninos.editar', 'ninos', 'Corregir datos generales con auditoría.'),
    ('evaluaciones.ver', 'evaluaciones', 'Consultar evaluaciones e historial.'),
    ('evaluaciones.crear', 'evaluaciones', 'Registrar evaluaciones manuales.'),
    ('evaluaciones.anular', 'evaluaciones', 'Anular una evaluación incorrecta con justificación.'),
    ('alertas.ver', 'alertas', 'Consultar alertas nutricionales.'),
    ('alertas.atender', 'alertas', 'Revisar, atender o descartar alertas.'),
    ('reportes.generar', 'reportes', 'Generar y descargar reportes autorizados.'),
    ('auditoria.ver', 'auditoria', 'Consultar la trazabilidad de operaciones.'),
    ('respaldos.gestionar', 'respaldos', 'Ejecutar y verificar respaldos.'),
    ('patrones.gestionar', 'configuracion', 'Administrar patrones y reglas validadas.')
ON DUPLICATE KEY UPDATE
    modulo = VALUES(modulo), descripcion = VALUES(descripcion), activo = TRUE;

INSERT INTO modulos_menu
    (codigo, nombre, descripcion, icono, ruta_base, orden)
VALUES
    ('DASHBOARD', 'Inicio', 'Resumen general de NUTRITECH.',
     'LayoutDashboard', '/dashboard', 10),
    ('NINOS', 'Niños', 'Registro y consulta de expedientes infantiles.',
     'Baby', '/ninos', 20),
    ('EVALUACIONES', 'Evaluaciones', 'Mediciones e historial nutricional.',
     'ClipboardPlus', '/evaluaciones', 30),
    ('ALERTAS', 'Alertas', 'Registros que requieren revisión profesional.',
     'TriangleAlert', '/alertas', 40),
    ('REPORTES', 'Reportes', 'Generación de reportes autorizados.',
     'FileText', '/reportes', 50),
    ('SEGURIDAD', 'Seguridad', 'Usuarios, roles, menús, auditoría y respaldos.',
     'ShieldCheck', '/admin', 60),
    ('CONFIGURACION', 'Configuración', 'Parámetros y patrones nutricionales.',
     'Settings', '/admin/configuracion', 70)
ON DUPLICATE KEY UPDATE
    nombre = VALUES(nombre), descripcion = VALUES(descripcion),
    icono = VALUES(icono), ruta_base = VALUES(ruta_base),
    orden = VALUES(orden), activo = TRUE;

INSERT INTO opciones_menu
    (modulo_menu_id, menu_padre_id, codigo, nombre, tipo, ruta, icono, orden)
VALUES
    ((SELECT id FROM modulos_menu WHERE codigo = 'DASHBOARD'), NULL,
     'DASHBOARD_INICIO', 'Dashboard', 'ENLACE', '/dashboard', 'LayoutDashboard', 10),
    ((SELECT id FROM modulos_menu WHERE codigo = 'NINOS'), NULL,
     'NINOS_LISTAR', 'Listado de niños', 'ENLACE', '/ninos', 'List', 10),
    ((SELECT id FROM modulos_menu WHERE codigo = 'NINOS'), NULL,
     'NINOS_CREAR', 'Registrar niño', 'ENLACE', '/ninos/crear', 'UserPlus', 20),
    ((SELECT id FROM modulos_menu WHERE codigo = 'EVALUACIONES'), NULL,
     'EVALUACIONES_LISTAR', 'Historial de evaluaciones', 'ENLACE',
     '/evaluaciones', 'History', 10),
    ((SELECT id FROM modulos_menu WHERE codigo = 'EVALUACIONES'), NULL,
     'EVALUACIONES_CREAR', 'Capturar peso y altura', 'ENLACE',
     '/evaluaciones/crear', 'ClipboardPlus', 20),
    ((SELECT id FROM modulos_menu WHERE codigo = 'ALERTAS'), NULL,
     'ALERTAS_LISTAR', 'Alertas nutricionales', 'ENLACE',
     '/alertas', 'TriangleAlert', 10),
    ((SELECT id FROM modulos_menu WHERE codigo = 'REPORTES'), NULL,
     'REPORTES_GENERAR', 'Reportes PDF e impresión', 'ENLACE',
     '/reportes', 'FileDown', 10),
    ((SELECT id FROM modulos_menu WHERE codigo = 'SEGURIDAD'), NULL,
     'USUARIOS_LISTAR', 'Usuarios', 'ENLACE',
     '/admin/usuarios', 'Users', 10),
    ((SELECT id FROM modulos_menu WHERE codigo = 'SEGURIDAD'), NULL,
     'ROLES_PERMISOS', 'Roles y permisos', 'ENLACE',
     '/admin/roles', 'KeyRound', 20),
    ((SELECT id FROM modulos_menu WHERE codigo = 'SEGURIDAD'), NULL,
     'MENUS_GESTIONAR', 'Menús del sistema', 'ENLACE',
     '/admin/menus', 'PanelsTopLeft', 30),
    ((SELECT id FROM modulos_menu WHERE codigo = 'SEGURIDAD'), NULL,
     'AUDITORIA_LISTAR', 'Auditoría', 'ENLACE',
     '/admin/auditoria', 'ScrollText', 40),
    ((SELECT id FROM modulos_menu WHERE codigo = 'SEGURIDAD'), NULL,
     'RESPALDOS_GESTIONAR', 'Respaldos', 'ENLACE',
     '/admin/respaldos', 'DatabaseBackup', 50),
    ((SELECT id FROM modulos_menu WHERE codigo = 'CONFIGURACION'), NULL,
     'PATRONES_GESTIONAR', 'Patrones nutricionales', 'ENLACE',
     '/admin/configuracion/patrones', 'SlidersHorizontal', 10)
ON DUPLICATE KEY UPDATE
    nombre = VALUES(nombre), ruta = VALUES(ruta), icono = VALUES(icono),
    orden = VALUES(orden), visible = TRUE, activo = TRUE;

-- Relación entre cada opción del menú y el permiso que permite visualizarla.
INSERT IGNORE INTO opcion_menu_permiso (opcion_menu_id, permiso_id)
SELECT om.id, p.id
FROM opciones_menu om
JOIN permisos p ON
       (om.codigo = 'DASHBOARD_INICIO'       AND p.codigo = 'dashboard.ver')
    OR (om.codigo = 'NINOS_LISTAR'           AND p.codigo = 'ninos.ver')
    OR (om.codigo = 'NINOS_CREAR'            AND p.codigo = 'ninos.crear')
    OR (om.codigo = 'EVALUACIONES_LISTAR'     AND p.codigo = 'evaluaciones.ver')
    OR (om.codigo = 'EVALUACIONES_CREAR'      AND p.codigo = 'evaluaciones.crear')
    OR (om.codigo = 'ALERTAS_LISTAR'          AND p.codigo = 'alertas.ver')
    OR (om.codigo = 'REPORTES_GENERAR'        AND p.codigo = 'reportes.generar')
    OR (om.codigo = 'USUARIOS_LISTAR'         AND p.codigo = 'usuarios.ver')
    OR (om.codigo = 'ROLES_PERMISOS'          AND p.codigo = 'roles.gestionar')
    OR (om.codigo = 'MENUS_GESTIONAR'         AND p.codigo = 'menus.ver')
    OR (om.codigo = 'AUDITORIA_LISTAR'        AND p.codigo = 'auditoria.ver')
    OR (om.codigo = 'RESPALDOS_GESTIONAR'     AND p.codigo = 'respaldos.gestionar')
    OR (om.codigo = 'PATRONES_GESTIONAR'      AND p.codigo = 'patrones.gestionar');

INSERT INTO tipos_indicador
    (codigo, nombre, eje_referencia, variable_resultado, unidad_resultado, descripcion)
VALUES
    ('P_E', 'Peso para la edad', 'EDAD_DIAS', 'PESO_KG', 'kg',
     'Relaciona el peso medido con la edad exacta y el sexo.'),
    ('T_E', 'Talla para la edad', 'EDAD_DIAS', 'TALLA_CM', 'cm',
     'Relaciona la talla o longitud con la edad exacta y el sexo.'),
    ('P_T', 'Peso para la talla', 'TALLA_CM', 'PESO_KG', 'kg',
     'Relaciona el peso con la longitud o talla y el sexo.'),
    ('IMC_E', 'Índice de masa corporal para la edad', 'EDAD_DIAS', 'IMC', 'kg/m2',
     'Relaciona el IMC calculado con la edad exacta y el sexo.')
ON DUPLICATE KEY UPDATE
    nombre = VALUES(nombre), descripcion = VALUES(descripcion), activo = TRUE;

INSERT INTO patrones_crecimiento
    (codigo, nombre, organizacion_fuente, version, referencia_documental, activo)
VALUES
    ('OMS-2006', 'Patrones de crecimiento infantil',
     'Organización Mundial de la Salud', '2006',
     'Cargar únicamente parámetros y reglas provenientes de la fuente oficial validada.',
     FALSE)
ON DUPLICATE KEY UPDATE
    nombre = VALUES(nombre), referencia_documental = VALUES(referencia_documental);

-- Asignación inicial de permisos al administrador.
INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.codigo = 'ADMINISTRADOR';

-- Permisos operativos del médico y del nutricionista.
INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON p.codigo IN (
    'dashboard.ver',
    'ninos.ver', 'ninos.buscar', 'ninos.crear', 'ninos.editar',
    'evaluaciones.ver', 'evaluaciones.crear', 'evaluaciones.anular',
    'alertas.ver', 'alertas.atender', 'reportes.generar'
)
WHERE r.codigo IN ('MEDICO','NUTRICIONISTA');

-- El usuario normal solo recibe las funciones solicitadas. ninos.buscar es
-- un permiso interno para seleccionar al niño durante la captura; no está
-- relacionado con una opción del menú y por eso no muestra el módulo Niños.
INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON p.codigo IN (
    'ninos.buscar',
    'evaluaciones.crear',
    'alertas.ver',
    'reportes.generar'
)
WHERE r.codigo = 'USUARIO_NORMAL';

/*
Consulta base para el endpoint GET /api/menu:

SELECT modulo_id, modulo_codigo, modulo_nombre, modulo_icono, ruta_base,
       opcion_id, menu_padre_id, opcion_codigo, opcion_nombre, opcion_tipo,
       ruta, opcion_icono, abre_nueva_pestana
FROM vw_menu_usuario
WHERE usuario_id = ?
ORDER BY modulo_orden, opcion_orden, opcion_nombre;

Consulta de permisos efectivos para proteger botones y endpoints:

SELECT permiso_codigo
FROM vw_permisos_usuario
WHERE usuario_id = ?
ORDER BY permiso_codigo;

Laravel agrupa estas filas por modulo_id y devuelve JSON. La autorización de
las rutas debe seguir verificando permisos en middleware; ocultar una opción
del menú no reemplaza la seguridad del backend.

Menú esperado para USUARIO_NORMAL:
- Evaluaciones > Capturar peso y altura.
- Alertas > Alertas nutricionales.
- Reportes > Reportes PDF e impresión.

La acción Imprimir usa el PDF ya generado y la función de impresión del
navegador. No necesita una tabla ni un permiso adicional, pero la generación
del archivo sí exige reportes.generar y debe registrarse en auditoría.

El administrador puede gestionar desde /admin/menus las tablas modulos_menu,
opciones_menu y opcion_menu_permiso. También puede personalizar un usuario por
medio de usuario_permiso sin editar registros manualmente en producción.
*/

/*
===============================================================================
 REGLAS QUE DEBE APLICAR LARAVEL EN UNA TRANSACCIÓN
===============================================================================

REGISTRAR NIÑO
1. Normalizar certificado y calcular certificado_hash.
2. Buscar por certificado_hash; si existe, rechazar como duplicado.
3. Cifrar certificado, generar ULID/código de expediente e insertar niño.
4. Insertar responsable y relación si fueron proporcionados.
5. Registrar la operación en registros_auditoria sin datos sensibles en claro.

REGISTRAR EVALUACIÓN
1. Bloquear/leer el niño y verificar que esté activo.
2. Calcular edad exacta en días usando fecha_nacimiento y evaluado_en.
3. Aplicar la política de edad del proyecto: menor de cinco años.
4. Validar peso, talla, tipo de medición y coherencia de fechas.
5. Insertar la evaluación (origen MANUAL_WEB).
6. Obtener parámetros del patrón activo y calcular indicadores.
7. Insertar resultados_indicador indicando versión de patrón y algoritmo.
8. Crear alertas solo cuando la regla validada lo ordene.
9. Registrar auditoría y confirmar toda la transacción.

CORREGIR EVALUACIÓN
1. No ejecutar UPDATE sobre peso/talla de una evaluación ya validada.
2. Marcar la anterior como ANULADA con usuario, fecha y motivo.
3. Crear una nueva fila y enlazar reemplaza_evaluacion_id.
4. Recalcular resultados/alertas y registrar auditoría.

SEGURIDAD OPERATIVA
- Usuario de aplicación: SELECT/INSERT/UPDATE/EXECUTE; sin DROP ni GRANT.
- Usuario de migraciones separado del usuario utilizado por Laravel en producción.
- TLS para conexiones; cifrado del disco y de los respaldos.
- Respaldos automáticos diarios, retención definida y prueba de restauración mensual.
- Redis funciona como caché: nunca será la fuente oficial de los expedientes.
- Excluir contrasena_hash, token_hash y datos cifrados de logs y reportes.
===============================================================================
*/
