/** Escenarios enteramente sintéticos sobre cartografía de referencia real.
 * No representa hechos ocurridos, no consulta fuentes ni modifica almacenamiento.
 */
import { ENUMS, SCOPE_BOUNDS } from './data.mjs?v=20261118-rural1';
import { contains, extent, norm } from './territory.mjs?v=20261118-rural1';

function randomGenerator(seed) {
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  const key = state.toString(16).padStart(8, '0');
  return { key, next() { state = (state + 0x6D2B79F5) >>> 0; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; } };
}
function shuffle(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
function dateBefore(today, days) {
  const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - days); return date.toISOString().slice(0, 10);
}
function interiorPoint(zone, parent, box, random, municipal) {
  for (let attempt = 0; attempt < 220; attempt++) {
    const x = Number((box[0] + (box[2] - box[0]) * random()).toFixed(7));
    const y = Number((box[1] + (box[3] - box[1]) * random()).toFixed(7));
    if (x < SCOPE_BOUNDS.west || x > SCOPE_BOUNDS.east || y < SCOPE_BOUNDS.south || y > SCOPE_BOUNDS.north) continue;
    if (contains(zone, x, y) && (!parent || contains(parent, x, y)) && (!municipal?.features?.length || municipal.features.some(f=>contains(f,x,y)))) return [x, y];
  }
  // Con geometrías incompatibles se conserva Solo zona; nunca se usa un centroide.
  return null;
}

/**
 * count = hechos únicos (1..2400); añade floor(count * .05) fuentes del mismo hecho.
 * Entrada: barrios, comunas y veredas preparados con territory.prepare(); salida: filas crudas
 * listas para validateRecords(rows, {demo:true,today}). El seed reproduce un escenario.
 */
export function generateDemoRecords({ barrios = [], comunas = [], veredas = [], municipal = null, today, count = 1200, seed = 1 } = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 2400) throw new Error('La simulación admite entre 1 y 2400 hechos enteros.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today || '') || !Number.isFinite(Date.parse(`${today}T12:00:00Z`)) || new Date(`${today}T12:00:00Z`).toISOString().slice(0, 10) !== today) throw new Error('Indica una fecha de corte válida para la simulación.');
  const rng = randomGenerator(seed), random = () => rng.next();
  const includeRural=veredas.length>0;
  const candidates = barrios.filter(zone => Number(zone.properties?.COMUNA) >= 1 && Number(zone.properties?.COMUNA) <= 5 && (!includeRural || !/^RURAL/.test(String(zone.properties?.SUELO || '').toUpperCase())) && extent([zone])).sort((a, b) => (a.displayLabel || a.label).localeCompare(b.displayLabel || b.label, 'es'));
  if (!candidates.length && !veredas.length) return [];
  const ruralPlaces=includeRural?barrios.filter(z=>z.properties?.AMBITO==='Rural'||/^RURAL/.test(String(z.properties?.SUELO||'').toUpperCase())):[];
  const sanMiguel=ruralPlaces.find(z=>norm(z.label)==='SANMIGUEL');
  const ruralHotspots=shuffle(veredas,random).slice(0,2);
  const allCandidates=[...candidates,...veredas,...ruralPlaces];
  const zoneType=zone=>zone.layer==='veredas'?'Vereda':zone.properties?.TIPO_ZONA==='Centro poblado'?'Centro poblado':'Barrio';
  const comunaCodes = shuffle([...new Set(candidates.map(z => Number(z.properties.COMUNA)))].sort(), random);
  const lead = shuffle(candidates.filter(z => Number(z.properties.COMUNA) === comunaCodes[0]), random);
  const other = shuffle(candidates.filter(z => Number(z.properties.COMUNA) !== comunaCodes[0]), random);
  const hotspots = [lead[0], lead[1] || lead[0], other[0] || lead[0]];
  const boxes = new Map(allCandidates.map(z => [z.id, extent([z])]));
  const parentFor = new Map(candidates.map(z => [z.id, comunas.find(c => c.aliases?.includes(norm(z.properties.COMUNA)))]));
  const sources = ['Facebook', 'Oficial', 'Medio local'];
  const rows = [];
  for (let i = 0; i < count; i++) {
    const weight = random();
    let zone = weight < .34 ? hotspots[0] : weight < .56 ? hotspots[1] : weight < .70 ? hotspots[2] : candidates[Math.floor(random() * candidates.length)];
    if(includeRural){
      const roll=random();
      if(sanMiguel&&i%20===0)zone=sanMiguel;
      else if(roll<.36)zone=ruralPlaces.length&&random()<.18?ruralPlaces[Math.floor(random()*ruralPlaces.length)]:random()<.68?ruralHotspots[Math.floor(random()*ruralHotspots.length)]:veredas[Math.floor(random()*veredas.length)];
    }
    if(!zone)zone=veredas[Math.floor(random()*veredas.length)];
    const age = Math.floor(random() * 90), locationRoll = random();
    const unlocated = locationRoll < .05;
    const point = !unlocated && locationRoll < .30 ? interiorPoint(zone, parentFor.get(zone.id), boxes.get(zone.id), random, municipal) : null;
    const source = sources[Math.floor(random() * sources.length)];
    const incident = `DEMO-${rng.key}-I${String(i + 1).padStart(4, '0')}`;
    rows.push({
      registro_id: `DEMO-${rng.key}-R${String(i + 1).padStart(4, '0')}`, incidente_id: incident,
      fecha_hecho: dateBefore(today, age), fecha_publicacion: dateBefore(today, Math.max(0, age - Math.floor(random() * 3))), fecha_consulta: today,
      delito: ENUMS.delito[Math.floor(random() * ENUMS.delito.length)],
      zona: unlocated ? '' : zone.displayLabel || zone.label, tipo_zona: unlocated ? 'Sin ubicar' : zoneType(zone),
      latitud: point?.[1] ?? '', longitud: point?.[0] ?? '', precision_ubicacion: unlocated ? 'Sin ubicar' : point ? 'Punto verificado' : 'Solo zona',
      fuente: source, url_fuente: '', verificacion: source === 'Oficial' ? 'Registro oficial' : random() < .4 ? 'Contrastado' : 'Pendiente',
      resumen: 'DATOS SINTÉTICOS. Incidente inventado exclusivamente para probar filtros y concentración territorial. No describe delitos, personas ni fuentes reales. Las coordenadas, cuando existen, se generaron al azar dentro de la cartografía de referencia.',
      responsable_revision: 'Generador sintético',
    });
  }
  for (let i = 0; i < Math.floor(count * .05); i++) {
    const original = rows[i * 20], source = sources[(sources.indexOf(original.fuente) + 1) % sources.length];
    rows.push({ ...original, registro_id: `DEMO-${rng.key}-R${String(count + i + 1).padStart(4, '0')}`, fuente: source, verificacion: source === 'Oficial' ? 'Registro oficial' : 'Contrastado' });
  }
  return rows;
}
