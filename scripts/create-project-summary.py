"""Resumen funcional de la versión local, actualizado el 6 de octubre de 2026."""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output/pdf/nutritech-resumen-funcional.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
BLUE = colors.HexColor("#2563A6")
GREEN = colors.HexColor("#2E8B70")
INK = colors.HexColor("#2F3A45")
MUTED = colors.HexColor("#6B7280")
PALE = colors.HexColor("#E8F1FA")
LIGHT = colors.HexColor("#E8F5EF")
LINE = colors.HexColor("#D8E4EF")
W, H = A4
WIDTH = W - 92
styles = {
    "eyebrow": ParagraphStyle("eyebrow", fontName="Helvetica-Bold", fontSize=9, leading=13, textColor=GREEN, spaceAfter=8),
    "title": ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=25, leading=29, textColor=BLUE, spaceAfter=13),
    "intro": ParagraphStyle("intro", fontName="Helvetica", fontSize=11, leading=16, textColor=INK, spaceAfter=14),
    "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=BLUE, spaceBefore=10, spaceAfter=6, keepWithNext=True),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=10, leading=14, textColor=INK, spaceAfter=7),
    "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8.5, leading=12, textColor=MUTED, spaceAfter=5),
    "cell": ParagraphStyle("cell", fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=INK, alignment=TA_LEFT),
    "label": ParagraphStyle("label", fontName="Helvetica-Bold", fontSize=9.5, leading=13.5, textColor=BLUE),
}
story = []

def p(text, kind="body"):
    story.append(Paragraph(text, styles[kind]))

def section(title, text):
    p(title, "h2")
    p(text)

def box(text, background=PALE):
    table = Table([[Paragraph(text, styles["body"])]], colWidths=[WIDTH])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), background),
        ("LEFTPADDING", (0, 0), (-1, -1), 13), ("RIGHTPADDING", (0, 0), (-1, -1), 13),
        ("TOPPADDING", (0, 0), (-1, -1), 11), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.extend([table, Spacer(1, 9)])

def rows(items):
    table = Table([[Paragraph(a, styles["label"]), Paragraph(b, styles["cell"])] for a, b in items], colWidths=[124, WIDTH-124])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#F4F6F8")]),
        ("LINEBELOW", (0, 0), (-1, -1), .4, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    story.extend([table, Spacer(1, 6)])

def page(number, title, intro):
    if number > 1:
        story.append(PageBreak())
    p(f"RESUMEN FUNCIONAL  /  {number:02d}", "eyebrow")
    p(title, "title")
    p(intro, "intro")

page(1, "NutriTech: lo que ya tenemos", "Sistema web de seguimiento nutricional infantil. Resumen de la versión local, actualizado el 6 de octubre de 2026.")
box("<b>Objetivo:</b> facilitar el registro de niños, sus mediciones y el seguimiento de su crecimiento, con orientación comprensible para la familia. Las decisiones clínicas corresponden al profesional de salud.", LIGHT)
section("Acceso y vistas de trabajo", "El inicio de sesión utiliza un código de acceso y contraseña. Cada cuenta ve las opciones permitidas por sus roles. La interfaz ofrece accesos por tarea, formularios guiados, mensajes de validación y la paleta azul y verde de NutriTech.")
rows([
    ("Usuario normal", "Consulta sin expediente, resultado temporal y reporte. Puede registrar al niño y guardar la evaluación si tiene los permisos. En Crecimiento consulta referencias por edad y el historial registrado por su propia cuenta."),
    ("Administración", "Panel con totales y pendientes; acceso a expedientes, evaluaciones, crecimiento, alertas, reportes y herramientas de gestión, según permisos."),
    ("Personal médico", "Registra su valoración por separado de la orientación automática, con el permiso específico. Ser administrador no concede por sí solo esa facultad."),
])
section("Seguridad de la cuenta", "JWT gestiona las sesiones y bcrypt protege las contraseñas: no se pueden consultar en texto legible. Hay cierre de sesión, bloqueo temporal por intentos fallidos y restablecimiento desde administración o mediante el comando local. El cambio de contraseña invalida las sesiones anteriores.")
section("Tecnologías del proyecto", "Backend con Node.js, NestJS y TypeScript; frontend con React, TypeScript, Vite y Tailwind CSS. Prisma conecta con MariaDB 10.11, administrada mediante phpMyAdmin. Se incluye configuración de despliegue local con Docker/Podman y Nginx.")
p("La vista previa de usuario normal permite revisar su diseño; no cambia la identidad ni los permisos de la cuenta administradora.", "small")

page(2, "Registrar y evaluar sin perderse", "Dos recorridos: una consulta temporal para orientar a la familia, o una evaluación guardada para continuar el seguimiento.")
rows([
    ("Niños y expedientes", "Búsqueda por nombre o expediente, registro con fecha de nacimiento y sexo, comunidad y dirección. El certificado ayuda a evitar duplicados. El detalle reúne los datos y sus responsables."),
    ("Padres y responsables", "Búsqueda por DPI para reutilizar un responsable existente, o registro de uno nuevo y vínculo con el niño. Correo opcional. Un responsable puede vincularse con varios niños."),
    ("Comunidades", "Catálogo seleccionable con búsqueda y gestión de comunidades: crear, editar o desactivar según permisos. Las comunidades ficticias sirven para demostraciones."),
    ("Correcciones", "Edición de nombres, dirección y estado del expediente con motivo. Una medición incorrecta se anula conservando autor, fecha y justificación; no se borra su trazabilidad."),
])
section("Consulta sin registro", "El formulario guía la captura de nacimiento, fecha, sexo, peso, talla y método de medición. Presenta un resultado y permite imprimir o guardar un PDF temporal sin crear historial. El botón para registrar al bebé reutiliza los datos ingresados y continúa el procedimiento de guardado.")
section("Evaluación de un niño registrado", "Se selecciona un expediente y se completan sus medidas. La edad se calcula automáticamente. Al guardar se calcula la orientación y se preparan los avisos de seguimiento. El historial se consulta por niño para evitar mezclar pacientes; las observaciones son opcionales.")
section("Resultados explicados para la familia", "El resultado resume qué indican las medidas, qué revisar y cuál es el siguiente paso. Compara peso con talla y talla con edad cuando los datos lo permiten. Los puntajes Z, las fuentes y otros detalles técnicos quedan en una sección adicional.")
box("<b>Datos que requieren revisión:</b> las medidas poco plausibles y los datos incompletos se señalan antes de interpretar. El edema es hinchazón en ambos pies y debe valorarlo personal de salud; puede alterar la interpretación del peso. Si no se evaluó, se mantiene como desconocido.")

page(3, "Crecimiento, alertas y reportes", "Inicio incluye una tabla visual de peso y talla según la edad, para niño o niña, con los colores de NutriTech. Desde allí también se abre la gráfica del historial.")
section("Referencias de crecimiento", "La tabla mensual OMS muestra valores centrales de peso y longitud/talla hasta los cinco años. Con fecha de nacimiento, fecha de consulta y sexo se obtiene la mediana OMS y una franja de referencia entre -2 y +2 desviaciones estándar. La edad se calcula en días. La referencia disponible cubre desde el nacimiento hasta 1826 días, aproximadamente cinco años.")
box("<b>Cómo interpretarla:</b> la referencia central no es un peso ideal único ni una meta. El peso para la edad, por sí solo, no permite diagnosticar sobrepeso u obesidad; se debe considerar también la talla y la valoración profesional.", LIGHT)
section("Gráfica por día, mes o año", "Elige un niño, filtra las fechas y selecciona la agrupación. Cada punto representa la última medición guardada de ese período. Al tocarlo se muestran su peso, talla, edad y avisos. Una tabla conserva todas las mediciones del filtro; los períodos sin registros no se rellenan con datos inventados.")
p("La curva compara los pesos registrados con la referencia OMS. Los puntos que requieren revisión se distinguen en naranja. Se excluyen las evaluaciones anuladas. En la vista normal solo aparece el historial registrado por la propia cuenta; la administración consulta según sus permisos.")
rows([
    ("Orientaciones", "El cálculo utiliza referencias OMS y documentación consolidada OMS/MSPAS. Se conservan fuentes y versiones de las orientaciones guardadas. Las comparaciones usan puntajes completos aunque la pantalla muestre dos decimales."),
    ("Valoración médica", "El profesional registra su decisión y observaciones de forma separada. La orientación automática se conserva como antecedente y no sustituye esa valoración."),
    ("Alertas", "Los avisos generados al guardar orientación aparecen en una bandeja. Se documenta el seguimiento y sus cambios de estado: pendiente, en revisión, atendida o descartada."),
    ("Reportes", "Resumen entendible para la familia, con medidas, orientación, recomendaciones y fuentes; los reportes guardados incluyen información de seguimiento. Se imprimen o se guardan como PDF desde el navegador."),
])
p('Fuente del nuevo módulo: <link href="https://www.who.int/tools/child-growth-standards/standards/weight-for-age" color="#2563A6">OMS, patrones de crecimiento infantil: peso para la edad</link>. <link href="https://www.who.int/tools/child-growth-standards/standards/length-height-for-age" color="#2563A6">OMS: longitud/talla para la edad</link>. Tablas oficiales verificadas del proyecto.', "small")

page(4, "Gestión y funcionamiento", "Las funciones de administración mantienen el acceso, la organización y la trazabilidad de la aplicación.")
rows([
    ("Inicio y ayuda", "Accesos a las tareas frecuentes y resumen de niños, evaluaciones y alertas. La ayuda orienta sobre los recorridos. Los totales dependen de los permisos de la cuenta."),
    ("Usuarios y roles", "Crear y editar cuentas, asignar roles y restablecer contraseñas. Administrar los permisos de los roles existentes. El servidor verifica los permisos en cada operación protegida."),
    ("Menús", "Organizar las opciones implementadas y su visibilidad. Ocultar una opción del menú no elimina el permiso para utilizarla."),
    ("Auditoría", "Consultar las operaciones registradas, su autor y fecha. Se conserva la trazabilidad de correcciones y cambios relevantes."),
    ("Respaldos", "Generar copias cifradas, verificar su integridad y disponer de un procedimiento separado para ensayar la restauración."),
    ("Referencias", "Consultar patrones nutricionales, parámetros y reglas documentadas. La importación verifica las referencias oficiales; no es un editor libre de criterios clínicos."),
])
section("¿Qué llega a la base de datos?", "Los expedientes, vínculos familiares, evaluaciones guardadas, orientaciones, valoraciones, alertas y reportes persistentes se almacenan en la MariaDB configurada para el backend. phpMyAdmin permite ver esa misma base si apunta al mismo servidor y esquema. Los cambios de diseño son archivos del proyecto.")
p("Las consultas temporales y la búsqueda de un peso de referencia no crean historial clínico. Crecimiento lee las evaluaciones ya guardadas; no modifica sus medidas ni crea evaluaciones nuevas.")
section("Recorrido sugerido para una demostración", "1. Entrar con la cuenta correspondiente.  2. Realizar una consulta temporal.  3. Registrar al niño y vincular a su responsable.  4. Guardar una evaluación.  5. Revisar resultado, crecimiento y alertas.  6. Generar un reporte y mostrar el seguimiento.")
section("Alcance actual", "La entrega funciona como aplicación local; no se ha publicado en internet. Aún requiere validación institucional para uso clínico real. No realiza notificación epidemiológica oficial, firma digital certificada ni prescripción automática. La orientación apoya al profesional, que conserva la decisión final.")
p("Verificación del módulo nuevo: seis pruebas unitarias y siete de integración, además de compilación, revisión de permisos y comprobación visual en el navegador. Fecha de revisión: 06/10/2026.", "small")

def decorate(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BLUE)
    canvas.setFont("Helvetica-Bold", 12)
    canvas.drawString(46, H-34, "NUTRI")
    canvas.setFillColor(GREEN)
    canvas.drawString(84, H-34, "TECH")
    canvas.setStrokeColor(LINE)
    canvas.line(46, H-44, W-46, H-44)
    canvas.line(46, 44, W-46, 44)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(46, 30, "NutriTech | Resumen de funciones | 06/10/2026")
    canvas.drawRightString(W-46, 30, f"{doc.page} / 4")
    canvas.restoreState()

doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, rightMargin=46, leftMargin=46, topMargin=65, bottomMargin=57, title="NutriTech - Resumen funcional", author="Proyecto NutriTech")
doc.build(story, onFirstPage=decorate, onLaterPages=decorate)
print(OUTPUT)
