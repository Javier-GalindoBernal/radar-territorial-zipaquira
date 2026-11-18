/** Motor local de datos. No realiza solicitudes ni conserva datos fuera del navegador. */
export const COLUMNS = Object.freeze([
  'registro_id', 'incidente_id', 'fecha_hecho', 'fecha_publicacion', 'fecha_consulta',
  'delito', 'zona', 'tipo_zona', 'latitud', 'longitud', 'precision_ubicacion',
  'fuente', 'url_fuente', 'verificacion', 'resumen', 'responsable_revision',
]);

export const ENUMS = Object.freeze({
  delito: ['Hurto a personas', 'Hurto a vehículos', 'Hurto a comercio', 'Lesiones personales', 'Otro incidente'],
  tipo_zona: ['Barrio', 'Comuna', 'Vereda', 'Centro poblado', 'Sector', 'Sin ubicar'],
  precision_ubicacion: ['Punto verificado', 'Aproximada', 'Solo zona', 'Sin ubicar'],
  fuente: ['Facebook', 'Oficial', 'Medio local', 'Reporte voluntario'],
  verificacion: ['Pendiente', 'Contrastado', 'Registro oficial'],
});
export const DEFAULT_TODAY = '2026-11-16';
export const SCOPE_BOUNDS = Object.freeze({ south: 4.92, north: 5.18, west: -74.18, east: -73.86 });

function detectDelimiter(text) {
  let quoted = false, commas = 0, semicolons = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted) {
      if (c === '\n' || c === '\r') break;
      if (c === ',') commas++;
      if (c === ';') semicolons++;
    }
  }
  return semicolons > commas ? ';' : ',';
}

/** Lee comas o punto y coma; las comillas dobles siguen RFC 4180. */
export function parseCSV(input) {
  if (typeof input !== 'string') throw new Error('El archivo debe contener texto CSV.');
  const text = input.replace(/^\uFEFF/, '');
  if (!text.trim()) return [];
  const delimiter = detectDelimiter(text);
  const rows = []; let row = [], cell = '', quoted = false, closedQuote = false;
  const pushCell = () => { row.push(cell); cell = ''; closedQuote = false; };
  const pushRow = () => { pushCell(); if (row.some(v => v.trim() !== '')) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closedQuote = true; }
      else cell += c;
    } else if (c === delimiter) pushCell();
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      pushRow();
    } else if (c === '"') {
      if (cell !== '' || closedQuote) throw new Error('Comillas fuera de lugar en el CSV.');
      quoted = true;
    } else {
      if (closedQuote) {
        if (c === ' ' || c === '\t') continue;
        throw new Error('Hay texto después del cierre de comillas en el CSV.');
      }
      cell += c;
    }
  }
  if (quoted) throw new Error('El CSV contiene comillas sin cerrar.');
  if (cell !== '' || row.length || closedQuote) pushRow();
  if (!rows.length) return [];
  const headers = rows.shift().map(s => s.trim());
  if (headers.some(h => !h)) throw new Error('El CSV tiene una columna sin nombre.');
  if (new Set(headers).size !== headers.length) throw new Error('El CSV tiene nombres de columna repetidos.');
  const unknown = headers.filter(h => !COLUMNS.includes(h));
  if (unknown.length) throw new Error(`Columnas no admitidas: ${unknown.join(', ')}. Usa la plantilla sin datos personales.`);
  return rows.map((values, i) => {
    if (values.length !== headers.length) throw new Error(`La fila ${i + 2} tiene ${values.length} campos; se esperaban ${headers.length}.`);
    const record = Object.create(null);
    headers.forEach((header, j) => { record[header] = values[j]; });
    return record;
  });
}

function spreadsheetSafe(value) {
  let s = value == null ? '' : String(value);
  // Una coordenada numérica negativa es dato, no una fórmula.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(s) && !/^-\d+(?:\.\d+)?$/.test(s)) s = `'${s}`;
  if (/^[\t\r\n]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Exporta solamente columnas del esquema; nunca añade perfiles u otros campos. */
export function toCSV(records) {
  return '\uFEFF' + [COLUMNS.map(spreadsheetSafe).join(','),
    ...records.map(row => COLUMNS.map(k => spreadsheetSafe(row[k])).join(','))].join('\r\n') + '\r\n';
}

function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() === y && date.getUTCMonth() + 1 === m && date.getUTCDate() === d;
}

function publicURL(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!host.includes('.') || host === 'localhost' || host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal')) return false;
    if (host.includes(':') || /^\[/.test(host)) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split('.').map(Number);
      if (a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a >= 224) return false;
    }
    return true;
  } catch { return false; }
}

/** Lote atómico: cualquier error devuelve records=[] y mantiene intacto el conjunto previo. */
export function validateRecords(rows, { demo = false, today = DEFAULT_TODAY } = {}) {
  const errors = [], warnings = [], records = [], ids = new Set(), urls = new Map();
  if (!Array.isArray(rows)) return { records: [], errors: [{ row: 0, message: 'Se esperaba una lista de registros.' }], warnings };
  if (!isDate(today)) throw new Error('La fecha de corte de validación no es válida.');
  rows.forEach((input, index) => {
    const row = index + 2, fail = message => errors.push({ row, message });
    if (!input || typeof input !== 'object' || Array.isArray(input)) { fail('Registro inválido.'); return; }
    const r = Object.fromEntries(COLUMNS.map(key => [key, String(input[key] ?? '').trim()]));
    for (const key of ['registro_id', 'incidente_id']) {
      if (!r[key]) fail(`Falta ${key}.`);
      else if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(r[key])) fail(`${key} debe tener hasta 80 letras sin tildes, números, guiones o puntos; no uses identificaciones personales.`);
    }
    if (ids.has(r.registro_id)) fail(`registro_id repetido: ${r.registro_id}.`);
    ids.add(r.registro_id);
    for (const key of ['delito', 'fuente', 'verificacion']) {
      if (!ENUMS[key].includes(r[key])) fail(`${key} no coincide con las opciones de la plantilla.`);
    }
    for (const key of ['fecha_hecho', 'fecha_publicacion', 'fecha_consulta']) {
      if (!r[key]) { if (key === 'fecha_consulta') fail('Falta fecha_consulta.'); continue; }
      if (!isDate(r[key])) fail(`${key} debe ser una fecha real en formato AAAA-MM-DD.`);
      else if (r[key] > today) fail(`${key} está después del corte ${today}.`);
    }
    if (isDate(r.fecha_consulta)) {
      for (const key of ['fecha_hecho', 'fecha_publicacion']) {
        if (isDate(r[key]) && r[key] > r.fecha_consulta) fail(`${key} no puede ser posterior a fecha_consulta.`);
      }
    }
    if (!r.fecha_hecho) warnings.push({ row, message: 'Sin fecha del hecho: no entra en comparaciones con filtro de fechas.' });
    if (!r.zona) r.tipo_zona = 'Sin ubicar';
    if (!r.tipo_zona) r.tipo_zona = 'Sin ubicar';
    if (!ENUMS.tipo_zona.includes(r.tipo_zona)) fail('tipo_zona no es válido.');
    if (r.zona && r.tipo_zona === 'Sin ubicar') fail('Indica el tipo de zona o deja la zona vacía.');
    if (!r.precision_ubicacion) r.precision_ubicacion = r.zona ? 'Solo zona' : 'Sin ubicar';
    if (!ENUMS.precision_ubicacion.includes(r.precision_ubicacion)) fail('precision_ubicacion no es válida.');
    if (!demo && !publicURL(r.url_fuente)) fail('url_fuente debe ser una URL pública http/https válida, sin credenciales.');
    if (r.url_fuente && !publicURL(r.url_fuente)) fail('La URL de fuente no es segura o no es pública.');
    if (r.fuente !== 'Oficial' && r.verificacion === 'Registro oficial') fail('Solo una fuente Oficial puede tener verificación Registro oficial.');
    const lat = r.latitud === '' ? null : Number(r.latitud), lon = r.longitud === '' ? null : Number(r.longitud);
    if ((lat === null) !== (lon === null)) fail('Latitud y longitud deben informarse juntas.');
    if (lat !== null && lon !== null) {
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) fail('Coordenadas numéricas fuera del rango mundial.');
      else if (lat < SCOPE_BOUNDS.south || lat > SCOPE_BOUNDS.north || lon < SCOPE_BOUNDS.west || lon > SCOPE_BOUNDS.east) fail('Coordenadas fuera del área de trabajo aproximada de Zipaquirá; revisa el lugar del hecho.');
      if (['Solo zona', 'Sin ubicar'].includes(r.precision_ubicacion)) fail('Una ubicación Solo zona o Sin ubicar no admite coordenadas de un punto.');
    }
    if (['Punto verificado', 'Aproximada'].includes(r.precision_ubicacion) && (lat === null || lon === null)) fail('La precisión seleccionada requiere latitud y longitud.');
    if (r.precision_ubicacion === 'Solo zona' && !r.zona) fail('Solo zona requiere el nombre de la zona.');
    if (r.precision_ubicacion === 'Sin ubicar' && r.zona) fail('Sin ubicar requiere dejar la zona vacía.');
    if (r.zona.length > 100 || r.resumen.length > 600 || r.responsable_revision.length > 100) fail('Texto demasiado extenso: zona/responsable hasta 100 caracteres y resumen hasta 600.');
    if (r.resumen && /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(r.resumen)) fail('El resumen contiene un correo: anonimiza los datos personales antes de importar.');
    if (r.url_fuente && urls.has(r.url_fuente) && urls.get(r.url_fuente) !== r.incidente_id) warnings.push({ row, message: 'La misma fuente aparece con otro incidente_id: revisa si se está contando el mismo hecho dos veces.' });
    if (r.url_fuente) urls.set(r.url_fuente, r.incidente_id);
    records.push({ ...r, latitud: lat, longitud: lon });
  });
  return { records: errors.length ? [] : records, errors, warnings };
}

function uniqueValues(records, key) { return [...new Set(records.map(r => r[key]).filter(v => v !== '' && v != null))]; }

/** id_incidente es una relación revisada por el usuario; no se deduce de similitud textual. */
export function groupIncidents(records) {
  const map = new Map();
  for (const record of records) {
    if (!map.has(record.incidente_id)) map.set(record.incidente_id, []);
    map.get(record.incidente_id).push(record);
  }
  return [...map.entries()].map(([id, reports]) => {
    const conflictFields = ['delito', 'fecha_hecho', 'zona', 'tipo_zona'];
    // "Sin ubicar" es ausencia de ubicación, no un conflicto con un reporte ubicado.
    const hasConflict = conflictFields.some(key => uniqueValues(key === 'tipo_zona' ? reports.filter(r => r.tipo_zona !== 'Sin ubicar') : reports, key).length > 1);
    const points = new Set(reports.filter(r => r.latitud != null && r.longitud != null).map(r => `${r.latitud},${r.longitud}`));
    const conflict = hasConflict || points.size > 1;
    const pointRecord = reports.find(r => r.latitud != null && r.longitud != null && r.precision_ubicacion === 'Punto verificado') ?? reports.find(r => r.latitud != null && r.longitud != null);
    const zoneRecord = reports.find(r => r.zona);
    const strongest = ['Registro oficial', 'Contrastado', 'Pendiente'].find(value => reports.some(r => r.verificacion === value));
    return {
      id, records: reports, delito: uniqueValues(reports, 'delito')[0] ?? '',
      zona: conflict && uniqueValues(reports, 'zona').length > 1 ? '' : zoneRecord?.zona ?? '',
      tipo_zona: zoneRecord?.tipo_zona ?? 'Sin ubicar',
      fecha_hecho: uniqueValues(reports, 'fecha_hecho').length > 1 ? '' : uniqueValues(reports, 'fecha_hecho')[0] ?? '',
      latitud: conflict ? null : pointRecord?.latitud ?? null,
      longitud: conflict ? null : pointRecord?.longitud ?? null,
      precision_ubicacion: conflict ? 'Sin ubicar' : pointRecord?.precision_ubicacion ?? (zoneRecord ? 'Solo zona' : 'Sin ubicar'),
      verificacion: strongest ?? 'Pendiente', conflict,
    };
  });
}

export function filterRecords(records, filters = {}) {
  return records.filter(r => {
    if ((filters.from || filters.to) && !r.fecha_hecho) return false;
    if (filters.from && r.fecha_hecho < filters.from || filters.to && r.fecha_hecho > filters.to) return false;
    return ['delito', 'fuente', 'zona', 'verificacion'].every(key => !filters[key] || filters[key] === 'Todos' || filters[key] === 'Todas' || r[key] === filters[key]);
  });
}
