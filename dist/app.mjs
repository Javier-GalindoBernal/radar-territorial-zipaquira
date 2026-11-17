import { TerritoryMap, prepare, model as territoryModel } from './territory.mjs';
import { COLUMNS, ENUMS, parseCSV, toCSV, validateRecords, groupIncidents, filterRecords } from './data.mjs';
import { generateDemoRecords } from './demo.mjs';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'radar-zipaquira-trabajo-v1';
const TODAY = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const start = new Date(`${TODAY}T12:00:00Z`); start.setUTCDate(start.getUTCDate() - 89);
const DEFAULT_FROM = start.toISOString().slice(0, 10);
let mode = 'work', work = [], geometry = null, geoMeta = null, editingId = null, pendingDelete = null, mapView = 'municipality';
let savedProblem = '', storageAvailable = true;
let activeLayer = 'comunas', areas = { comunas: [], barrios: [] }, areaMeta = null;
let demoRows = [], demoSeed = 17, mapStyle = 'heat', tablePage = 0;
const PAGE_SIZE = 60;
const territory = new TerritoryMap($('map'), $('map-selection'), id => { $('map-zone').value = id || ''; });

const fmt = n => new Intl.NumberFormat('es-CO').format(n);
const day = date => date ? date.split('-').reverse().join('/') : 'Fecha del hecho desconocida';
function element(tag, text, className) { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; }
function say(text, error = false) { const node = $('message'); node.textContent = text; node.classList.toggle('error', error); node.hidden = !text; }
function currentRows() { return mode === 'demo' ? demoRows : work; }
function filters() { return { from: $('filter-from').value, to: $('filter-to').value, delito: $('filter-delito').value, fuente: $('filter-fuente').value, zona: $('filter-zona').value, verificacion: $('filter-verificacion').value }; }
function filteredRows() { const f = filters(); return f.from && f.to && f.from > f.to ? [] : filterRecords(currentRows(), f); }
function issueText(issues) { return issues.slice(0, 6).map(i => `Fila ${i.row}: ${i.message}`).join('\n') + (issues.length > 6 ? `\nY ${issues.length - 6} observaciones más.` : ''); }
function saveWork() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: work })); storageAvailable = true; }
  catch { storageAvailable = false; say('Los cambios están en esta sesión, pero no pudieron guardarse en el navegador. Exporta una copia antes de cerrar.', true); }
}
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) { const data = JSON.parse(saved); if (data.version !== 1 || !Array.isArray(data.records)) throw new Error('Formato no compatible.'); const v = validateRecords(data.records, { today: TODAY }); if (v.errors.length) throw new Error(issueText(v.errors)); work = v.records; }
} catch (error) { savedProblem = `No se pudo abrir el conjunto guardado. No se ha sobrescrito. ${error.message}`; storageAvailable = false; }

function makeDemo() {
  const raw = generateDemoRecords({ barrios: areas.barrios, comunas: areas.comunas, today: TODAY, count: Number($('demo-size').value), seed: demoSeed });
  const result = validateRecords(raw, { demo: true, today: TODAY });
  if (result.errors.length) throw new Error(issueText(result.errors));
  demoRows = result.records;
}

for (const key of ['delito', 'fuente', 'verificacion']) for (const value of ENUMS[key]) $('filter-' + key).append(new Option(value, value));
for (const [key, values] of Object.entries(ENUMS)) for (const value of values) $('record-form').elements.namedItem(key).append(new Option(value, value));
for (const input of document.querySelectorAll('input[type="date"]')) input.max = TODAY;
$('filter-from').value = DEFAULT_FROM; $('filter-to').value = TODAY;

function setMode(next) {
  tablePage = 0; territory.reset();
  mode = next; mapView = 'municipality'; say(''); $('work-mode').classList.toggle('active', next === 'work'); $('demo-mode').classList.toggle('active', next === 'demo'); $('work-mode').setAttribute('aria-pressed', String(next === 'work')); $('demo-mode').setAttribute('aria-pressed', String(next === 'demo'));
  $('demo-banner').hidden = next !== 'demo'; $('map-demo-label').hidden = next !== 'demo';
  $('demo-controls').hidden = next !== 'demo';
  $('add-record').disabled = next === 'demo'; $('import-button').disabled = next === 'demo';
  $('matrix-description').textContent = next === 'demo' ? 'Datos sintéticos sobre barrios reales. No describen delitos reales; no se guardan ni se exportan.' : 'Cada fila conserva la fuente y el vínculo con su incidente.';
  refreshZones(); render();
}
function refreshZones() {
  const select = $('filter-zona'), prior = select.value;
  select.replaceChildren(new Option('Todas las zonas', ''));
  [...new Set(currentRows().map(r => r.zona).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')).forEach(z => select.append(new Option(z, z)));
  select.value = [...select.options].some(o => o.value === prior) ? prior : '';
}
function groupsForView() {
  const conflicts = new Set(groupIncidents(currentRows()).filter(g => g.conflict).map(g => g.id));
  return groupIncidents(filteredRows()).map(g => conflicts.has(g.id) ? { ...g, conflict: true, latitud: null, longitud: null } : g);
}


function render() {
  const rows = filteredRows(), groups = groupsForView(), spatial = territoryModel(groups, areas, activeLayer, geometry), mapped = [...spatial.mappedIds], f = filters();
  $('metric-incidents').textContent = fmt(groups.length); $('metric-records').textContent = fmt(rows.length); $('metric-unmapped').textContent = fmt(groups.length - mapped.length);
  const conflicts = groups.filter(g => g.conflict).length;
  $('unmapped-detail').textContent = conflicts ? `${conflicts} con datos contradictorios; requieren revisión` : 'Sin asignación sustentada a la capa territorial activa';
  const unknown = groupIncidents(currentRows()).filter(g => !g.fecha_hecho).length;
  const note = [];
  if (f.from && f.to && f.from > f.to) note.push('El inicio del período debe ser anterior o igual al final.');
  else note.push(`${fmt(rows.length)} registros de ${fmt(currentRows().length)} · ${f.from || f.to ? 'Filtro por fecha del hecho' : 'Sin filtro temporal'}`);
  if ((f.from || f.to) && unknown) note.push(`${unknown} incidentes sin fecha del hecho quedan fuera del período`);
  if (f.fuente === '') note.push('Las fuentes del mismo incidente comparten ID para evitar doble conteo');
  $('filter-note').textContent = note.join(' · ');
  $('export-button').disabled = mode !== 'work' || rows.length === 0;
  $('storage-status').textContent = mode === 'demo' ? 'El ejemplo no modifica tus registros.' : storageAvailable ? 'Tus registros se guardan en este navegador. Exporta una copia como respaldo.' : 'Guardado local no disponible: exporta antes de cerrar.';
  renderRanking(spatial); renderTable(rows); drawMap(groups, spatial);
}
function renderRanking(data) {
  const container = $('zone-ranking'); container.replaceChildren();
  const ranking = data.zones.map(zone => ({ zone, count: data.counts.get(zone.id)?.length || 0 })).filter(r => r.count > 0).sort((a,b) => b.count-a.count || a.zone.label.localeCompare(b.zone.label,'es'));
  const insight = $('heat-insight'); insight.replaceChildren();
  if (!ranking.length) {
    container.append(element('p', 'Sin incidentes asignados a esta capa con los filtros actuales.', 'rank-empty'));
    insight.append(element('strong', 'Sin concentración para mostrar'), element('span', 'Cambia los filtros o explora los datos sintéticos. Sin registros no significa ausencia de delitos.'));
    return;
  }
  for (const {zone, count} of ranking.slice(0,8)) {
    const row = element('button', null, 'rank-item'), label = element('div', null, 'rank-label'); row.type = 'button';
    row.setAttribute('aria-label', `Ver ${zone.displayLabel || zone.label}: ${count} incidentes${mode==='demo'?', sintéticos':''}`);
    label.append(element('span', zone.displayLabel || zone.label), element('strong', fmt(count)));
    const track = element('div', null, 'rank-track'), bar = element('div', null, 'rank-bar'); bar.style.width = `${count / ranking[0].count * 100}%`; track.append(bar); row.append(label,track); row.addEventListener('click',()=>territory.select(zone.id,true)); container.append(row);
  }
  const top=ranking[0], percent=new Intl.NumberFormat('es-CO',{maximumFractionDigits:1}).format(top.count/data.mappedIds.size*100);
  insight.append(element('span', mode==='demo'?'Mayor concentración en esta simulación':'Mayor concentración en esta muestra'), element('strong',top.zone.displayLabel || top.zone.label), element('span', `${fmt(top.count)} incidentes · ${percent}% de los asignados a ${activeLayer==='barrios'?'barrios y sectores':'comunas'}. Cantidades, no tasas de riesgo.`));
  const omitted = data.total-data.mappedIds.size;
  if (omitted) container.append(element('p', `${fmt(omitted)} incidentes sin asignación a esta capa.`, 'field-hint'));
  if (ranking.length > 8) container.append(element('p', 'Se muestran las ocho zonas con más incidentes identificados. La matriz incluye las demás.', 'field-hint'));
}
function renderTable(rows) {
  const tbody = $('records-table'); tbody.replaceChildren();
  if (!rows.length) { if ($('matrix-pagination')) $('matrix-pagination').hidden=true; const tr = element('tr'), td = element('td', currentRows().length ? 'No hay registros que coincidan con estos filtros.' : 'Tu matriz está vacía. Registra un incidente o importa la plantilla diligenciada.', 'table-empty'); td.colSpan = 5; tr.append(td); tbody.append(tr); return; }
  const groups = new Map(groupIncidents(currentRows()).map(g => [g.id, g]));
  const sorted = [...rows].sort((a, b) => b.fecha_hecho.localeCompare(a.fecha_hecho) || a.incidente_id.localeCompare(b.incidente_id));
  tablePage = Math.max(0,Math.min(tablePage,Math.ceil(rows.length/PAGE_SIZE)-1));
  for (const r of sorted.slice(tablePage*PAGE_SIZE,(tablePage+1)*PAGE_SIZE)) {
    const tr = element('tr'), first = element('td'); first.append(element('strong', r.incidente_id), element('span', day(r.fecha_hecho), 'subline')); if (groups.get(r.incidente_id)?.conflict) first.append(element('span', 'Datos contradictorios', 'subline'));
    const description = element('td'); description.append(element('strong', r.delito), element('span', r.zona ? `${r.tipo_zona}: ${r.zona}` : 'Sin ubicación verificada', 'subline'));
    const detail = element('details'), summary = element('summary', 'Ver resumen'); detail.append(summary, element('p', r.resumen || 'Sin resumen.'), element('p', `Registro: ${r.registro_id} · Publicación: ${day(r.fecha_publicacion)} · Consulta: ${day(r.fecha_consulta)} · Revisión: ${r.responsable_revision || 'Sin responsable indicado'} · Precisión: ${r.precision_ubicacion}`)); description.append(detail);
    const source = element('td'); source.append(element('span', r.fuente)); if (mode !== 'demo' && r.url_fuente) { const link = element('a', 'Abrir fuente ↗', 'subline'); link.href = r.url_fuente; link.target = '_blank'; link.rel = 'noopener noreferrer'; source.append(link); } else source.append(element('span', 'Ficticio, sin fuente real', 'subline'));
    const state = element('td'); state.append(element('span', r.verificacion, 'status ' + r.verificacion.toLowerCase().replace(/ /g, '-')));
    const actions = element('td'); if (mode === 'work') { const edit = element('button', 'Editar', 'row-action'), remove = element('button', 'Eliminar', 'row-action remove'); edit.type = remove.type = 'button'; edit.setAttribute('aria-label', `Editar ${r.registro_id}`); remove.setAttribute('aria-label', `Eliminar ${r.registro_id}`); edit.addEventListener('click', () => openForm(r)); remove.addEventListener('click', () => { pendingDelete = r.registro_id; $('delete-dialog').showModal(); }); actions.append(edit, remove); } else actions.append(element('span', 'Ejemplo', 'subline'));
    tr.append(first, description, source, state, actions); tbody.append(tr);
  }
  let pager = $('matrix-pagination');
  if (!pager) { pager = element('div', null, 'matrix-pagination'); pager.id='matrix-pagination'; tbody.closest('.table-wrap').after(pager); }
  pager.replaceChildren(); pager.hidden=rows.length<=PAGE_SIZE;
  if (rows.length>PAGE_SIZE) {
    const previous=element('button','← Anterior','button'), next=element('button','Siguiente →','button'); previous.type=next.type='button';previous.disabled=tablePage===0;next.disabled=(tablePage+1)*PAGE_SIZE>=rows.length;
    previous.addEventListener('click',()=>{tablePage--;renderTable(rows);});next.addEventListener('click',()=>{tablePage++;renderTable(rows);});
    pager.append(previous,element('span',`${fmt(tablePage*PAGE_SIZE+1)}–${fmt(Math.min(rows.length,(tablePage+1)*PAGE_SIZE))} de ${fmt(rows.length)} registros`),next);
  }
}

function refreshMapZones() {
  const selector = $('map-zone'); selector.replaceChildren(new Option('Selecciona una zona', ''));
  for (const zone of [...areas[activeLayer]].sort((a, b) => a.label.localeCompare(b.label, 'es'))) selector.append(new Option(zone.displayLabel || zone.label, zone.id));
  const names = $('zone-names'); names.replaceChildren();
  for (const zone of [...areas.comunas, ...areas.barrios]) names.append(new Option(zone.displayLabel || zone.label, zone.displayLabel || zone.label));
}
function drawMap(groups, data) {
  territory.update(data, geometry, mode === 'demo', mapStyle);
  $('map-empty').hidden = areas[activeLayer].length > 0;
  if (!areas[activeLayer].length) { $('map-empty').querySelector('strong').textContent = 'Preparando la cartografía territorial'; $('map-empty').querySelector('p').textContent = 'Los límites de barrios y comunas se mostrarán aquí, incluso sin incidentes cargados.'; $('empty-demo').hidden = true; }
  $('mapped-detail').textContent = `${data.mappedIds.size} de ${groups.length} incidentes asignados a esta capa`;
  const legend=$('map-legend');legend.replaceChildren();
  if (mapStyle==='heat' && data.mappedIds.size) {
    const scale=element('span',null,'heat-scale');scale.append(element('span','Menor'),element('span',null,'heat-gradient'),element('span','Mayor'));legend.append(scale,element('span','Concentración por zona · escala relativa a esta vista'));
  } else legend.textContent=mapStyle==='heat'?'Sin incidentes asignados: no hay intensidad para representar':'Colores territoriales: distinguen zonas, no niveles de inseguridad';
  $('map-source').replaceChildren();
  const note = document.createElement('span');
  note.textContent = activeLayer === 'comunas' ? 'Comunas: fuente municipal declarada, republicación académica; Acuerdo 08 de 2014 según metadatos. ' : 'Barrios: fuente municipal declarada, republicación académica; edición declarada abril 2026. ';
  note.textContent += 'Cartografía referencial; no acredita límites jurídicos vigentes. ';
  const link = document.createElement('a'); link.href = 'fuentes-zonas.json'; link.textContent = 'Ver procedencia y fechas ↗'; link.target = '_blank'; link.rel = 'noopener';
  $('map-source').append(note, link);
}
function newId(prefix) { return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`; }
function openForm(record = null) {
  if (mode !== 'work') return;
  const form = $('record-form'); form.reset(); editingId = record?.registro_id || null;
  const defaults = { registro_id: newId('R'), incidente_id: newId('I'), fecha_consulta: TODAY, delito: 'Hurto a personas', fuente: 'Facebook', verificacion: 'Pendiente', tipo_zona: 'Sin ubicar', precision_ubicacion: 'Sin ubicar', responsable_revision: 'Analista' };
  for (const field of COLUMNS) form.elements.namedItem(field).value = (record || defaults)[field] ?? '';
  $('dialog-title').textContent = record ? 'Editar registro' : 'Registrar incidente'; $('form-error').hidden = true; $('record-dialog').showModal();
}
$('record-form').addEventListener('submit', event => {
  event.preventDefault(); const raw = Object.fromEntries(new FormData(event.currentTarget)), prior = work.filter(r => r.registro_id !== editingId); const validation = validateRecords([...prior, raw], { today: TODAY });
  if (validation.errors.length) { $('form-error').textContent = issueText(validation.errors); $('form-error').hidden = false; return; }
  work = validation.records; saveWork(); refreshZones(); render(); $('record-dialog').close(); if (storageAvailable) say('Registro guardado. Revisa el ID de incidente para relacionar otras fuentes del mismo hecho.' + (validation.warnings.length ? '\n' + issueText(validation.warnings) : ''));
});
const form = $('record-form');
form.elements.namedItem('tipo_zona').addEventListener('change', event => { const zone = form.elements.namedItem('zona'); if (event.target.value === 'Sin ubicar') { zone.value = ''; form.elements.namedItem('precision_ubicacion').value = 'Sin ubicar'; } else if (form.elements.namedItem('precision_ubicacion').value === 'Sin ubicar') form.elements.namedItem('precision_ubicacion').value = 'Solo zona'; });
$('add-record').addEventListener('click', () => openForm());
for (const id of ['close-dialog', 'cancel-dialog']) $(id).addEventListener('click', () => $('record-dialog').close());
$('cancel-delete').addEventListener('click', () => $('delete-dialog').close());
$('confirm-delete').addEventListener('click', () => { work = work.filter(r => r.registro_id !== pendingDelete); pendingDelete = null; saveWork(); refreshZones(); render(); $('delete-dialog').close(); if (storageAvailable) say('Registro eliminado del conjunto de trabajo.'); });
$('work-mode').addEventListener('click', () => setMode('work'));
for (const id of ['demo-mode', 'empty-demo']) $(id).addEventListener('click', () => setMode('demo'));
for (const key of ['from', 'to', 'delito', 'fuente', 'zona', 'verificacion']) $('filter-' + key).addEventListener('change', () => { tablePage=0; mapView = 'municipality'; render(); });
$('clear-filters').addEventListener('click', () => { tablePage=0;for (const key of ['from', 'to', 'delito', 'fuente', 'zona', 'verificacion']) $('filter-' + key).value = ''; render(); });
for (const [id, style] of [['map-heat','heat'],['map-territory','territory']]) $(id).addEventListener('click',()=>{
  mapStyle=style;for(const [button,value] of [['map-heat','heat'],['map-territory','territory']]) { $(button).classList.toggle('active',style===value);$(button).setAttribute('aria-pressed',String(style===value)); }render();
});
function regenerateDemo(){demoSeed++;makeDemo();tablePage=0;$('filter-zona').value='';territory.reset();refreshZones();render();}
$('demo-regenerate').addEventListener('click',regenerateDemo);
$('demo-size').addEventListener('change',regenerateDemo);
for (const layer of ['comunas', 'barrios']) $('layer-' + layer).addEventListener('click', () => {
  activeLayer = layer; territory.setLayer(layer); refreshMapZones();
  for (const value of ['comunas', 'barrios']) { $('layer-' + value).classList.toggle('active', layer === value); $('layer-' + value).setAttribute('aria-pressed', String(layer === value)); }
  render();
});
$('map-zone').addEventListener('change', event => territory.select(event.target.value || null, true));
$('map-zoom-in').addEventListener('click', () => territory.zoom(1.5));
$('map-zoom-out').addEventListener('click', () => territory.zoom(1 / 1.5));
$('map-reset').addEventListener('click', () => { territory.reset(); $('map-zone').value = ''; render(); });
$('map-full').addEventListener('click',()=>territory.fitAll());
$('import-button').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try { if (file.size > 2 * 1024 * 1024) throw new Error('El archivo supera 2 MB. Divide el conjunto en lotes más pequeños.'); const rows = parseCSV(await file.text()); if (!rows.length) throw new Error('La matriz está vacía. Diligencia al menos un registro.'); const v = validateRecords([...work, ...rows], { today: TODAY }); if (v.errors.length) throw new Error('No se importó ninguna fila. Corrige la matriz:\n' + issueText(v.errors)); work = v.records; saveWork(); refreshZones(); render(); if (storageAvailable) say(`${rows.length} registros incorporados. Se conserva el conjunto anterior.` + (v.warnings.length ? '\n' + issueText(v.warnings) : '')); }
  catch (error) { say(error.message, true); } finally { event.target.value = ''; }
});
$('export-button').addEventListener('click', () => {
  if (mode !== 'work') return; const rows = filteredRows(); if (!rows.length) return;
  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `zipaquira-registros-filtrados-${TODAY}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); say(`Se exportaron ${rows.length} registros de la vista actual. Quita los filtros y exporta de nuevo si necesitas el respaldo completo.`);
});

if (window.matchMedia('(min-width:1000px)').matches) $('filters-disclosure').open = true;
refreshZones(); render(); if (savedProblem) say(savedProblem, true);
try {
  const urls = ['limite-zipaquira.geojson', 'cartografia.json', 'comunas.geojson', 'barrios.geojson', 'fuentes-zonas.json'];
  const responses = await Promise.all(urls.map(url => fetch(url)));
  const data = await Promise.all(responses.map(r => r.ok ? r.json() : null));
  if (data[0]?.features?.length) geometry = data[0]; geoMeta = data[1];
  areas.comunas = prepare(data[2], 'comunas'); areas.barrios = prepare(data[3], 'barrios'); areaMeta = data[4];
  makeDemo();refreshMapZones();setMode(work.length?'work':'demo');
} catch { $('map-source').textContent = 'No se pudo abrir la cartografía de referencia. Recarga la vista o consulta la guía.'; }
