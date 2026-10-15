"""Extrae medianas mensuales de seis tablas PDF oficiales OMS ya descargadas.

Requiere pypdf. No modifica los parámetros clínicos ni la base de datos.
"""
from pathlib import Path
from hashlib import sha256
import json
import re
from pypdf import PdfReader

root = Path(__file__).resolve().parents[1] / 'database/references/growth-monthly'
base = 'https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/'
paths = {
    'wfa-boys.pdf': 'weight-for-age/wfa-boys-0-5-zscores.pdf',
    'wfa-girls.pdf': 'weight-for-age/wfa-girls-0-5-zscores.pdf',
    'lfa-boys.pdf': 'length-height-for-age/lfa_boys_0_2_zscores.pdf',
    'lfa-girls.pdf': 'length-height-for-age/lfa_girls_0_2_zscores.pdf',
    'hfa-boys.pdf': 'length-height-for-age/hfa_boys_2_5_zscoresba2ba0820f064f4abf5915abac01e894.pdf',
    'hfa-girls.pdf': 'length-height-for-age/hfa_girls_2_5_zscores.pdf',
}
tables = {}
sources = []
for name, source_path in paths.items():
    path = root / name
    text = '\n'.join(page.extract_text() for page in PdfReader(path).pages)
    matches = re.findall(r'(?m)^\s*(\d):\s*(\d+)\s+(\d+)\s+(-?[\d.]+)\s+([\d.]+)\s+([\d.]+)\s', text)
    rows = {}
    for year, month, total, _l, median, _s in matches:
        assert int(year) * 12 + int(month) == int(total), name
        assert int(total) not in rows, name
        rows[int(total)] = float(median)
    expected = range(61) if name.startswith('wfa') else range(25) if name.startswith('lfa') else range(24, 61)
    assert set(rows) == set(expected), (name, len(rows))
    tables[name] = rows
    sources.append({'archivo': name, 'url': base + source_path, 'sha256': sha256(path.read_bytes()).hexdigest()})

data = []
for sex, suffix in [('M', 'boys'), ('F', 'girls')]:
    for age in range(61):
        data.append({
            'sexo': sex,
            'meses': age,
            'peso_kg': tables[f'wfa-{suffix}.pdf'][age],
            'talla_cm': tables[f"{'lfa' if age < 24 else 'hfa'}-{suffix}.pdf"][age],
            'tipo_medicion': 'LONGITUD_ACOSTADO' if age < 24 else 'TALLA_DE_PIE',
        })
out = root / 'medians.json'
out.write_text(json.dumps(data, indent=2) + '\n')
manifest = {'version': 'OMS-2006-mensual-1', 'consultado_en': '2026-10-05', 'sha256': sha256(out.read_bytes()).hexdigest(), 'fuentes': sources}
(root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Verificadas y extraídas {len(data)} filas mensuales (61 por sexo).')
