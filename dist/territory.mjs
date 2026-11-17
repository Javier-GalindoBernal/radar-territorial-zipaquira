const NS = 'http://www.w3.org/2000/svg';
export const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export function rings(feature) { const g = feature.geometry; return g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []; }
function inRing(x, y, ring) { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; }
export function contains(feature, x, y) { return rings(feature).some(p => inRing(x, y, p[0]) && !p.slice(1).some(h => inRing(x, y, h))); }
export function extent(features) { const coords = features.flatMap(f => rings(f).flat(2)); if (!coords.length) return null; const box = [Infinity, Infinity, -Infinity, -Infinity]; for (const [x, y] of coords) { box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y); } return box; }
function prop(properties, candidates) { for (const candidate of candidates) { const key = Object.keys(properties || {}).find(k => k.toUpperCase() === candidate); if (key && properties[key] !== null && String(properties[key]).trim()) return String(properties[key]).trim(); } return ''; }
export function prepare(fc, layer) { const features = (fc?.features || []).filter(f => rings(f).length).map((f, index) => {
  const p = f.properties || {}; let label = prop(p, layer === 'comunas' ? ['NOMBRE', 'NOM_COMUNA', 'NOMBRE_COMUNA', 'COMUNA', 'NAME', 'NUM_COMUNA'] : ['NOMBRE', 'NOM_BARRIO', 'NOMBRE_BARRIO', 'BARRIO', 'NAME', 'NOMBRE_1']);
  if (!label) label = `${layer === 'comunas' ? 'Comuna' : 'Barrio'} sin nombre (${index + 1})`;
  if (layer === 'comunas' && /^\d+$/.test(label)) label = 'Comuna ' + label;
  return { ...f, id: `${layer}-${index}`, label, layer, aliases: [...new Set([norm(label), ...(layer === 'comunas' ? [norm(label).replace(/^COMUNA/, '')] : [])])] };
}); const merged = new Map();
  for (const feature of features) {
    const key = norm(feature.label) + ':' + String(feature.properties?.COMUNA ?? '');
    if (!merged.has(key)) merged.set(key, feature);
    else { const first = merged.get(key); first.geometry = { type: 'MultiPolygon', coordinates: [...rings(first), ...rings(feature)] }; }
  }
  const result = [...merged.values()]; for (const f of result) { const duplicated = result.filter(o => norm(o.label) === norm(f.label)).length > 1; f.displayLabel = f.label + (duplicated ? ` · Comuna ${f.properties?.COMUNA || 'sin asignar'}` : ''); f.aliases = [...new Set([...f.aliases, norm(f.displayLabel)])]; } return result;
}
export function labelPoint(feature) {
  const polys = rings(feature), largest = [...polys].sort((a, b) => b[0].length - a[0].length)[0]; if (!largest) return [0, 0];
  const ring = largest[0]; let twiceArea = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) { const [x, y] = ring[i], [xx, yy] = ring[i + 1], a = x * yy - xx * y; twiceArea += a; cx += (x + xx) * a; cy += (y + yy) * a; }
  const center = [cx / (3 * twiceArea), cy / (3 * twiceArea)]; if (center.every(Number.isFinite) && contains(feature, ...center)) return center;
  const b = extent([feature]); const mid = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; if (contains(feature, ...mid)) return mid;
  for (let ix = 1; ix < 20; ix++) for (let iy = 1; iy < 20; iy++) { const point = [b[0] + (b[2] - b[0]) * ix / 20, b[1] + (b[3] - b[1]) * iy / 20]; if (contains(feature, ...point)) return point; }
  return ring[0];
}
export function model(groups, areas, layer, municipal) {
  const zones = areas[layer] || [], counts = new Map(zones.map(f => [f.id, []])), mappedIds = new Set();
  for (const g of groups) {
    if (g.conflict) continue;
    const verified = g.precision_ubicacion === 'Punto verificado' && Number.isFinite(g.longitud) && Number.isFinite(g.latitud);
    if (verified && municipal?.features?.length && !municipal.features.some(f => contains(f, g.longitud, g.latitud))) continue;
    let feature = verified ? zones.find(f => contains(f, g.longitud, g.latitud)) : null;
    if (!feature && !verified && ((layer === 'comunas' && g.tipo_zona === 'Comuna') || (layer === 'barrios' && g.tipo_zona === 'Barrio'))) { const matches = zones.filter(f => f.aliases.includes(norm(g.zona))); if (matches.length === 1) feature = matches[0]; }
    if (!feature && !verified && layer === 'comunas' && g.tipo_zona === 'Barrio') {
      const matches = (areas.barrios || []).filter(f => f.aliases.includes(norm(g.zona)));
      if (matches.length === 1 && Number(matches[0].properties?.COMUNA) > 0) {
        const parent = zones.filter(f => f.aliases.includes(norm(matches[0].properties.COMUNA)));
        if (parent.length === 1) feature = parent[0];
      }
    }
    if (feature) { counts.get(feature.id).push(g); mappedIds.add(g.id); }
  }
  return { zones, counts, mappedIds, total: groups.length };
}
function svg(tag, attrs = {}, text) { const node = document.createElementNS(NS, tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); if (text != null) node.textContent = text; return node; }
export class TerritoryMap {
  constructor(node, detail, onSelect = null) {
    this.node = node; this.detail = detail; this.onSelect = onSelect; this.zoomLevel = 1; this.pan = [0, 0]; this.layer = 'comunas'; this.selected = null; this.drag = null; this.didPan = false;
    node.addEventListener('pointerdown', e => { if (e.button !== 0) return; this.drag = { x: e.clientX, y: e.clientY, pan: [...this.pan] }; this.didPan = false; });
    node.addEventListener('pointermove', e => { if (!this.drag || !this.scale) return; const dx = (e.clientX - this.drag.x) * 820 / node.getBoundingClientRect().width, dy = (e.clientY - this.drag.y) * 430 / node.getBoundingClientRect().height; if (Math.abs(dx) + Math.abs(dy) > 5) this.didPan = true; if (this.didPan) { this.pan = [this.drag.pan[0] - dx / (this.scale * this.k), this.drag.pan[1] + dy / this.scale]; this.draw(); } });
    const end = () => { this.drag = null; }; node.addEventListener('pointerup', end); node.addEventListener('pointerleave', end); node.addEventListener('pointercancel', end);
  }
  update(data, municipal, demo = false) { this.data = data; this.municipal = municipal; this.demo = demo; this.draw(); }
  setLayer(layer) { this.layer = layer; this.reset(); }
  reset() { this.zoomLevel = 1; this.pan = [0, 0]; this.selected = null; }
  zoom(factor) { this.zoomLevel = Math.max(.7, Math.min(18, this.zoomLevel * factor)); this.draw(); }
  select(id, focus = false) {
    this.selected = id;
    this.onSelect?.(id);
    if (focus && id) { const f = this.data?.zones.find(z => z.id === id), base = extent(this.data?.zones || []), box = f && extent([f]);
      if (base && box) { this.pan = [(box[0] + box[2] - base[0] - base[2]) / 2, (box[1] + box[3] - base[1] - base[3]) / 2]; this.zoomLevel = Math.max(1, Math.min(18, Math.min((base[2] - base[0]) / (box[2] - box[0]), (base[3] - base[1]) / (box[3] - box[1])) * .65)); }
    }
    this.draw();
  }
  draw() {
    if (!this.data) return;
    const { node, data } = this, zones = data.zones, base = extent(zones) || extent(this.municipal?.features || []) || [-74.10, 4.96, -73.91, 5.16];
    const cx = (base[0] + base[2]) / 2 + this.pan[0], cy = (base[1] + base[3]) / 2 + this.pan[1], width = (base[2] - base[0]) * 1.13 / this.zoomLevel, height = (base[3] - base[1]) * 1.13 / this.zoomLevel;
    const b = [cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2]; this.k = Math.cos(cy * Math.PI / 180); this.scale = Math.min(760 / (width * this.k), 366 / height);
    const project = (x, y) => [410 + (x - cx) * this.k * this.scale, 215 - (y - cy) * this.scale];
    node.replaceChildren(svg('title', { id: 'map-title' }, `Zipaquirá por ${this.layer}`), svg('desc', { id: 'map-desc' }, `${zones.length} zonas cartografiadas. Selecciona una zona para consultar su nombre y los incidentes identificados. ${this.demo ? 'Los incidentes son ficticios.' : 'Sin registros no se puede concluir ausencia de delitos.'}`));
    const grid = svg('g', { stroke: '#dce6d0', 'stroke-width': '.6', 'pointer-events': 'none' }); for (let x = 0; x <= 820; x += 45) grid.append(svg('line', { x1: x, x2: x, y1: 0, y2: 430 })); for (let y = 0; y <= 430; y += 45) grid.append(svg('line', { x1: 0, x2: 820, y1: y, y2: y })); node.append(grid);
    const pathFor = feature => rings(feature).map(p => p.map(ring => ring.map(([x, y], i) => `${i ? 'L' : 'M'}${project(x, y).map(n => n.toFixed(2)).join(',')}`).join(' ') + 'Z').join(' ')).join(' ');
    for (const f of this.municipal?.features || []) node.append(svg('path', { d: pathFor(f), fill: '#e7eddb', stroke: '#b6c5a1', 'stroke-width': '1', 'fill-rule': 'evenodd', 'pointer-events': 'none' }));
    const max = Math.max(0, ...[...data.counts.values()].map(r => r.length)), colors = ['#dce6c8', '#cadcad', '#aecb89', '#83ac62', '#508b48', '#256b43'];
    const neutral = ['#dce8cf', '#d0e2c4', '#e1e8ca', '#ccdfc6', '#d9e3be', '#cde1d4'];
    for (let i = 0; i < zones.length; i++) { const f = zones[i], count = data.counts.get(f.id)?.length || 0, active = this.selected === f.id;
      const path = svg('path', { d: pathFor(f), fill: max ? (count ? colors[Math.min(5, Math.ceil(count / max * 5))] : '#e5ecda') : neutral[i % neutral.length], stroke: active ? '#164d3d' : '#94ac80', 'stroke-width': active ? '2.8' : '1', 'fill-rule': 'evenodd', class: 'territory-zone', role: 'button', tabindex: '0', 'aria-label': `${f.label}: ${count} incidentes identificados${this.demo ? ', ejemplo ficticio' : ''}`, 'aria-pressed': String(active) });
      path.append(svg('title', {}, `${f.label} · ${count ? count + ' incidentes identificados' : 'Sin registros en esta vista'}${this.demo ? ' · Ejemplo ficticio' : ''}`)); path.addEventListener('click', () => { if (!this.didPan) this.select(f.id); }); path.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.select(f.id); } }); node.append(path);
    }
    const labels = svg('g', { 'pointer-events': 'none' }), occupied = [], unit = 820 / Math.max(300, node.getBoundingClientRect().width);
    const labelSize = this.layer === 'comunas' ? 13 * unit : 11 * unit;
    for (const f of [...zones].sort((a, b) => (this.selected === b.id ? 1 : 0) - (this.selected === a.id ? 1 : 0))) {
      const center = f.labelPoint || (f.labelPoint = labelPoint(f)), [x, y] = project(...center); if (x < 20 || x > 800 || y < 15 || y > 410) continue;
      const selected = this.selected === f.id, label = f.label.length > 26 && !selected ? f.label.slice(0, 24) + '…' : f.label, box = [x - Math.min(175, label.length * labelSize * .28), y - labelSize * .6, x + Math.min(175, label.length * labelSize * .28), y + labelSize * .6];
      const overlaps = occupied.some(o => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1]); if (overlaps && !selected) continue; occupied.push(box);
      const text = svg('text', { x, y: y + 3, 'text-anchor': 'middle', fill: '#234b35', 'font-size': selected ? labelSize * 1.12 : labelSize, 'font-weight': selected || this.layer === 'comunas' ? 700 : 550, stroke: '#f7faef', 'stroke-width': 3, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, label); labels.append(text);
    }
    node.append(labels, svg('text', { x: 787, y: 28, fill: '#58764b', 'font-size': 11, 'text-anchor': 'middle', 'font-weight': 700 }, 'N'), svg('path', { d: 'M787,60 L787,37 M782,45 L787,37 L792,45', fill: 'none', stroke: '#58764b', 'stroke-width': 1.5 }));
    const meters = this.zoomLevel > 4 ? 200 : 1000, pixels = meters / 111320 * this.scale; node.append(svg('path', { d: `M25,390 L25,396 L${25 + pixels},396 L${25 + pixels},390`, fill: 'none', stroke: '#687f55', 'stroke-width': 1.5 }), svg('text', { x: 25, y: 413, fill: '#687f55', 'font-size': 10 }, `≈ ${meters === 1000 ? '1 km' : meters + ' m'}`));
    const selected = zones.find(f => f.id === this.selected); this.detail.replaceChildren();
    const title = document.createElement('strong'), line = document.createElement('span'); title.textContent = selected ? selected.displayLabel || selected.label : `${zones.length} ${this.layer === 'barrios' ? 'barrios y sectores' : 'comunas'} de referencia`; const n = selected ? data.counts.get(selected.id)?.length || 0 : data.mappedIds.size;
    line.textContent = selected ? `${n} incidentes identificados en esta vista${this.demo ? ' · Datos ficticios' : ''}. ${n ? 'Consulta las fuentes antes de concluir.' : 'Sin registros no significa ausencia de delitos.'}` : 'Selecciona una zona en el mapa o en el buscador. Acerca el mapa para leer los barrios más pequeños.'; this.detail.append(title, line);
    if (selected && this.layer === 'barrios') { const meta = document.createElement('span'); meta.textContent = `${Number(selected.properties?.COMUNA) > 0 ? 'Comuna ' + selected.properties.COMUNA : 'Sin comuna numerada en la fuente'} · Clasificación: ${selected.properties?.SUELO || 'No informada'}`; this.detail.append(meta); }
    if (selected && data.counts.get(selected.id)?.length) { const ids = document.createElement('span'); ids.textContent = 'Incidentes: ' + data.counts.get(selected.id).map(g => g.id).join(', '); ids.className = 'field-hint'; this.detail.append(ids); }
  }
}
