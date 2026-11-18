const NS = 'http://www.w3.org/2000/svg';
export const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export function rings(feature) { const g = feature.geometry; return g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []; }
function inRing(x, y, ring) { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; }
export function contains(feature, x, y) { return rings(feature).some(p => inRing(x, y, p[0]) && !p.slice(1).some(h => inRing(x, y, h))); }
export function extent(features) { const coords = features.flatMap(f => rings(f).flat(2)); if (!coords.length) return null; const box = [Infinity, Infinity, -Infinity, -Infinity]; for (const [x, y] of coords) { box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y); } return box; }
function prop(properties, candidates) { for (const candidate of candidates) { const key = Object.keys(properties || {}).find(k => k.toUpperCase() === candidate); if (key && properties[key] !== null && String(properties[key]).trim()) return String(properties[key]).trim(); } return ''; }
function veredaKey(value) { return norm(value).replace(/^(VEREDA|VDA)/, ''); }
function featureKind(feature) { return prop(feature.properties, ['TIPO_ZONA', 'TIPOZONA']); }
function isCentro(feature) { return norm(featureKind(feature)) === 'CENTROPOBLADO'; }
function named(zones, value) {
  const key = norm(value), matches = zones.filter(f => f.aliases.includes(key));
  return matches.length === 1 ? matches[0] : null;
}
export function prepare(fc, layer) {
  const fields = layer === 'comunas'
    ? ['NOMBRE', 'NOM_COMUNA', 'NOMBRE_COMUNA', 'COMUNA', 'NAME', 'NUM_COMUNA']
    : layer === 'veredas'
      ? ['NOMBRE', 'VEREDA', 'NOM_VEREDA', 'NOMBRE_VEREDA', 'NAME', 'NOMBRE_1']
      : ['NOMBRE', 'NOM_BARRIO', 'NOMBRE_BARRIO', 'BARRIO', 'NAME', 'NOMBRE_1'];
  const features = (fc?.features || []).filter(f => rings(f).length).map((f, index) => {
    let label = prop(f.properties || {}, fields);
    if (!label) label = (layer === 'comunas' ? 'Comuna' : layer === 'veredas' ? 'Vereda' : 'Barrio') + ' sin nombre (' + (index + 1) + ')';
    if (layer === 'comunas' && /^\d+$/.test(label)) label = 'Comuna ' + label;
    const aliases = [norm(label)];
    if (layer === 'comunas') aliases.push(norm(label).replace(/^COMUNA/, ''));
    if (layer === 'veredas') aliases.push(veredaKey(label), 'VEREDA' + veredaKey(label), 'VDA' + veredaKey(label));
    return { ...f, id: layer + '-' + index, label, layer, aliases: [...new Set(aliases)] };
  });
  const merged = new Map();
  for (const feature of features) {
    // Homónimos de vereda siguen separados: un nombre no acredita identidad territorial.
    const key = layer === 'veredas' ? feature.id : norm(feature.label) + ':' + String(feature.properties?.COMUNA ?? '') + ':' + norm(featureKind(feature));
    if (!merged.has(key)) merged.set(key, feature);
    else { const first = merged.get(key); first.geometry = { type: 'MultiPolygon', coordinates: [...rings(first), ...rings(feature)] }; }
  }
  const result = [...merged.values()];
  for (const f of result) {
    const duplicates = result.filter(o => layer === 'veredas' ? veredaKey(o.label) === veredaKey(f.label) : norm(o.label) === norm(f.label));
    f.displayLabel = f.label + (duplicates.length > 1
      ? layer === 'veredas' ? ' · referencia ' + (duplicates.indexOf(f) + 1) : ' · Comuna ' + (f.properties?.COMUNA || 'sin asignar')
      : isCentro(f) ? ' · Centro poblado' : '');
    f.aliases = [...new Set([...f.aliases, norm(f.displayLabel)])];
  }
  return result;
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
const EPS = 1e-9;
function pointOnRing(x, y, ring) {
  for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = ring[i - 1], [bx, by] = ring[i], cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (Math.abs(cross) <= EPS * Math.max(1, Math.abs(bx - ax) + Math.abs(by - ay)) &&
      x >= Math.min(ax, bx) - EPS && x <= Math.max(ax, bx) + EPS && y >= Math.min(ay, by) - EPS && y <= Math.max(ay, by) + EPS) return true;
  }
  return false;
}
function onFeature(feature, x, y) { return contains(feature, x, y) || rings(feature).some(p => p.some(r => pointOnRing(x, y, r))); }
function cross(a, b) { return a[0] * b[1] - a[1] * b[0]; }
function segmentInside(a, b, parent) {
  if (!onFeature(parent, ...a) || !onFeature(parent, ...b)) return false;
  const v = [b[0] - a[0], b[1] - a[1]], length = v[0] ** 2 + v[1] ** 2, cuts = [0, 1];
  if (!length) return true;
  for (const polygon of rings(parent)) for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
    const c = ring[i - 1], d = ring[i], edge = [d[0] - c[0], d[1] - c[1]], offset = [c[0] - a[0], c[1] - a[1]], divisor = cross(v, edge);
    if (Math.abs(divisor) > 1e-15) {
      const t = cross(offset, edge) / divisor, u = cross(offset, v) / divisor;
      if (t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS) cuts.push(Math.max(0, Math.min(1, t)));
    } else if (Math.abs(cross(offset, v)) < 1e-15) {
      for (const q of [c, d]) { const t = ((q[0] - a[0]) * v[0] + (q[1] - a[1]) * v[1]) / length; if (t > 0 && t < 1) cuts.push(t); }
    }
  }
  cuts.sort((x, y) => x - y);
  for (let i = 1; i < cuts.length; i++) { const t = (cuts[i - 1] + cuts[i]) / 2; if (!onFeature(parent, a[0] + v[0] * t, a[1] + v[1] * t)) return false; }
  return true;
}
/** Contención completa, sin convertir un centroide en prueba de pertenencia. */
export function within(child, parent) {
  const a = extent([child]), b = extent([parent]);
  if (!a || !b || a[0] < b[0] - EPS || a[1] < b[1] - EPS || a[2] > b[2] + EPS || a[3] > b[3] + EPS) return false;
  for (const polygon of rings(child)) for (const ring of polygon) for (let i = 1; i < ring.length; i++) if (!segmentInside(ring[i - 1], ring[i], parent)) return false;
  // Un hueco del padre encerrado por la superficie del hijo invalida la contención.
  for (const polygon of rings(parent)) for (const hole of polygon.slice(1)) if (hole.some(point => contains(child, ...point))) return false;
  return true;
}
const parentCache = new WeakMap();
function parentVereda(feature, veredas) {
  const declared = prop(feature.properties, ['VEREDA', 'NOM_VEREDA', 'NOMBRE_VEREDA']);
  if (declared) return named(veredas, declared);
  if (isCentro(feature)) return null;
  let cache = parentCache.get(feature); if (!cache) { cache = new WeakMap(); parentCache.set(feature, cache); }
  if (!cache.has(veredas)) { const parents = veredas.filter(v => within(feature, v)); cache.set(veredas, parents.length === 1 ? parents[0] : null); }
  return cache.get(veredas);
}
function verifiedPoint(g) { return g.precision_ubicacion === 'Punto verificado' && Number.isFinite(g.longitud) && Number.isFinite(g.latitud); }
function scopeOf(feature) {
  const labels = ['AMBITO', 'SUELO', 'TSUELO'].map(key => norm(prop(feature.properties, [key]))).filter(Boolean);
  const scopes = new Set(labels.map(value => value.startsWith('RURAL') ? 'Rural' : value === 'URBANO' || value === 'EXPANSIONURBANA' || value === 'URBANA' ? 'Urbano' : '').filter(Boolean));
  return scopes.size === 1 ? [...scopes][0] : 'Sin determinar';
}
/** Ámbito analítico según la cartografía, no certificación jurídica de clase de suelo. */
export function classifyScope(g, areas, municipal) {
  if (g.conflict) return 'Sin determinar';
  if (verifiedPoint(g)) {
    if (municipal?.features?.length && !municipal.features.some(f => contains(f, g.longitud, g.latitud))) return 'Sin determinar';
    const located = (areas.barrios || []).filter(f => contains(f, g.longitud, g.latitud));
    const declared = named(located, g.zona);
    if (declared && scopeOf(declared) !== 'Sin determinar') return scopeOf(declared);
    const scopes = new Set(located.map(scopeOf).filter(v => v !== 'Sin determinar'));
    if (scopes.size > 1) return 'Sin determinar';
    if (scopes.size === 1) return [...scopes][0];
    if ((areas.comunas || []).some(f => contains(f, g.longitud, g.latitud))) return 'Urbano';
    if ((areas.veredas || []).some(f => contains(f, g.longitud, g.latitud))) return 'Rural';
    return 'Sin determinar';
  }
  if (g.tipo_zona === 'Vereda') return named(areas.veredas || [], g.zona) ? 'Rural' : 'Sin determinar';
  if (g.tipo_zona === 'Comuna') return named(areas.comunas || [], g.zona) ? 'Urbano' : 'Sin determinar';
  if (['Barrio', 'Sector', 'Centro poblado'].includes(g.tipo_zona)) {
    const feature = named(areas.barrios || [], g.zona);
    if (!feature || g.tipo_zona === 'Centro poblado' && !isCentro(feature)) return 'Sin determinar';
    const scope = scopeOf(feature); if (scope !== 'Sin determinar') return scope;
    if (isCentro(feature)) return 'Sin determinar';
    const parent = Number(feature.properties?.COMUNA) > 0 && named(areas.comunas || [], String(feature.properties.COMUNA));
    if (parent) return 'Urbano';
  }
  return 'Sin determinar';
}
export function model(groups, areas, layer, municipal) {
  const zones = areas[layer] || [], counts = new Map(zones.map(f => [f.id, []])), mappedIds = new Set();
  for (const g of groups) {
    if (g.conflict || mappedIds.has(g.id)) continue;
    // Algunas divisiones veredales históricas cubren la cabecera: no volver rural un hecho urbano.
    if (layer === 'veredas' && classifyScope(g, areas, municipal) === 'Urbano') continue;
    const verified = verifiedPoint(g);
    if (verified && municipal?.features?.length && !municipal.features.some(f => contains(f, g.longitud, g.latitud))) continue;
    let feature = null;
    if (verified) {
      const matches = zones.filter(f => contains(f, g.longitud, g.latitud));
      feature = matches.length === 1 ? matches[0] : named(matches, g.zona);
    }
    if (!feature && !verified && (layer === 'comunas' && g.tipo_zona === 'Comuna' ||
      layer === 'barrios' && ['Barrio', 'Sector', 'Centro poblado'].includes(g.tipo_zona) ||
      layer === 'veredas' && g.tipo_zona === 'Vereda')) {
      feature = named(zones, g.zona);
      if (feature && g.tipo_zona === 'Centro poblado' && !isCentro(feature)) feature = null;
    }
    if (!feature && !verified && layer === 'comunas' && ['Barrio', 'Sector'].includes(g.tipo_zona)) {
      const child = named(areas.barrios || [], g.zona);
      if (child && !isCentro(child) && Number(child.properties?.COMUNA) > 0) feature = named(zones, String(child.properties.COMUNA));
    }
    if (!feature && !verified && layer === 'veredas' && ['Barrio', 'Sector', 'Centro poblado'].includes(g.tipo_zona)) {
      const child = named(areas.barrios || [], g.zona);
      if (child) feature = parentVereda(child, zones);
    }
    if (feature) { counts.get(feature.id).push(g); mappedIds.add(g.id); }
  }
  return { zones, counts, mappedIds, total: groups.length };
}
function svg(tag, attrs = {}, text) { const node = document.createElementNS(NS, tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); if (text != null) node.textContent = text; return node; }
export function heatColor(count, max) {
  if (!count || !max) return '#f2f0e9';
  const palette = ['#fff0b3','#ffda75','#ffb747','#f8892d','#e85d25','#cb351e','#982419'];
  return palette[Math.min(palette.length-1, Math.floor(count/max*(palette.length-1)))];
}
export class TerritoryMap {
  constructor(node, detail, onSelect = null) {
    Object.assign(this,{node,detail,onSelect,zoomLevel:1,pan:[0,0],layer:'comunas',selected:null,drag:null,didPan:false,full:false,style:'heat'});
    node.addEventListener('pointerdown', e => {
      if (e.button!==0) return;
      this.drag={x:e.clientX,y:e.clientY,pan:[...this.pan]};this.didPan=false;
    });
    node.addEventListener('pointermove', e => {
      if (!this.drag || !this.scale) return;
      const rect=node.getBoundingClientRect(), unit=Math.min(rect.width/820,rect.height/500);
      const dx=(e.clientX-this.drag.x)/unit,dy=(e.clientY-this.drag.y)/unit;
      if(Math.abs(dx)+Math.abs(dy)>5)this.didPan=true;
      if(this.didPan){this.pan=[this.drag.pan[0]-dx/(this.scale*this.k),this.drag.pan[1]+dy/this.scale];this.draw();}
    });
    const end=()=>{this.drag=null;};
    for(const event of ['pointerup','pointerleave','pointercancel'])node.addEventListener(event,end);
  }
  update(data,municipal,demo=false,style='heat'){Object.assign(this,{data,municipal,demo,style});this.draw();}
  setLayer(layer){this.layer=layer;this.reset();}
  baseExtent(){
    if(this.full||this.layer==='veredas')return extent(this.municipal?.features||[])||extent(this.data?.zones||[])||[-74.10,4.96,-73.91,5.16];
    const zones=this.data?.zones||[];
    return extent(zones)||extent(this.municipal?.features||[])||[-74.10,4.96,-73.91,5.16];
  }
  reset(){this.zoomLevel=1;this.pan=[0,0];this.selected=null;this.full=false;}
  fitAll(){this.reset();this.full=true;this.onSelect?.(null);this.draw();}
  zoom(factor){this.zoomLevel=Math.max(.7,Math.min(24,this.zoomLevel*factor));this.draw();}
  select(id,focus=false){
    this.selected=id;this.onSelect?.(id);
    if(focus&&id){
      const f=this.data?.zones.find(z=>z.id===id),base=this.baseExtent(),box=f&&extent([f]);
      if(base&&box){
        this.pan=[(box[0]+box[2]-base[0]-base[2])/2,(box[1]+box[3]-base[1]-base[3])/2];
        this.zoomLevel=Math.max(1,Math.min(24,Math.min((base[2]-base[0])/(box[2]-box[0]),(base[3]-base[1])/(box[3]-box[1]))*.72));
      }
    }
    this.draw();
  }
  draw(){
    if(!this.data)return;
    const {node,data}=this,zones=data.zones,base=this.baseExtent();
    const cx=(base[0]+base[2])/2+this.pan[0],cy=(base[1]+base[3])/2+this.pan[1];
    const width=(base[2]-base[0])*1.12/this.zoomLevel,height=(base[3]-base[1])*1.12/this.zoomLevel;
    this.k=Math.cos(cy*Math.PI/180);this.scale=Math.min(750/(width*this.k),422/height);
    const project=(x,y)=>[410+(x-cx)*this.k*this.scale,250-(y-cy)*this.scale];
    node.replaceChildren(svg('title',{id:'map-title'},'Zipaquirá por '+this.layer),svg('desc',{id:'map-desc'},zones.length+' zonas de referencia. '+(this.style==='heat'?'El mapa de calor representa el conteo de incidentes por zona, no una tasa de riesgo. ':'Los colores distinguen territorios. ')+(this.demo?'Incidentes enteramente sintéticos; no describen delitos reales.':'Sin registros no se puede concluir ausencia de delitos.')));
    const grid=svg('g',{stroke:'#e7e3db','stroke-width':'.6','pointer-events':'none'});
    for(let x=0;x<=820;x+=50)grid.append(svg('line',{x1:x,x2:x,y1:0,y2:500}));
    for(let y=0;y<=500;y+=50)grid.append(svg('line',{x1:0,x2:820,y1:y,y2:y}));
    node.append(grid);
    const pathFor=f=>rings(f).map(p=>p.map(r=>r.map(([x,y],i)=>(i?'L':'M')+project(x,y).map(n=>n.toFixed(2)).join(',')).join(' ')+'Z').join(' ')).join(' ');
    for(const f of this.municipal?.features||[])node.append(svg('path',{d:pathFor(f),fill:'#e9e7df',stroke:'#b9b5aa','stroke-width':'1.2','fill-rule':'evenodd','pointer-events':'none'}));
    const max=Math.max(0,...[...data.counts.values()].map(r=>r.length));
    const neutral=['#e6d6bd','#edddcb','#d7dfd5','#eadbc2','#d8d7ce'];
    const ordered=[...zones].sort((a,b)=>(this.selected===a.id?1:0)-(this.selected===b.id?1:0)||(data.counts.get(a.id)?.length||0)-(data.counts.get(b.id)?.length||0));
    for(let i=0;i<ordered.length;i++){
      const f=ordered[i],count=data.counts.get(f.id)?.length||0,active=this.selected===f.id;
      const fill=this.style==='heat'?heatColor(count,max):neutral[i%neutral.length];
      const path=svg('path',{d:pathFor(f),fill,stroke:active?'#45281a':'#a7927d','stroke-width':active?'3.2':'.9','fill-rule':'evenodd',class:'territory-zone',role:'button',tabindex:'0','data-zone':f.id,'data-count':count,'aria-label':(f.displayLabel||f.label)+': '+count+' incidentes'+(this.demo?' sintéticos':''),'aria-pressed':String(active)});
      path.append(svg('title',{},(f.displayLabel||f.label)+' · '+count+' incidentes'+(this.demo?' sintéticos':'')));
      path.addEventListener('click',()=>{if(!this.didPan)this.select(f.id);});
      path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.select(f.id);}});
      node.append(path);
    }
    const labels=svg('g',{'pointer-events':'none'}),occupied=[];
    const unit=820/Math.max(300,node.getBoundingClientRect().width),labelSize=(this.layer==='barrios'?14:17)*unit;
    const orderedLabels=[...zones].sort((a,b)=>(this.selected===b.id?1:0)-(this.selected===a.id?1:0)||(data.counts.get(b.id)?.length||0)-(data.counts.get(a.id)?.length||0));
    for(const f of orderedLabels){
      const [x,y]=project(...labelPoint(f));
      if(x<25||x>795||y<30||y>465)continue;
      const count=data.counts.get(f.id)?.length||0,selected=this.selected===f.id;
      if(this.style==='heat'&&max&&this.layer==='barrios'&&!count&&!selected)continue;
      const raw=f.label.replace(/^COMUNA[_ ]*/i,'Comuna '),label=raw.length>22&&!selected?raw.slice(0,21)+'…':raw;
      const box=[x-Math.min(180,label.length*labelSize*.29),y-labelSize*.7,x+Math.min(180,label.length*labelSize*.29),y+labelSize*(count?1.8:.7)];
      const overlap=occupied.some(o=>box[0]<o[2]&&box[2]>o[0]&&box[1]<o[3]&&box[3]>o[1]);
      if(overlap&&!selected)continue;occupied.push(box);
      labels.append(svg('text',{x,y,'text-anchor':'middle',fill:'#3e2b1d','font-size':labelSize,'font-weight':selected||this.layer!=='barrios'?750:600,stroke:'#fffdf3','stroke-width':4,'paint-order':'stroke','stroke-linejoin':'round'},label));
      if(count&&(this.style==='heat'||selected))labels.append(svg('text',{x,y:y+labelSize*1.25,'text-anchor':'middle',fill:'#5d2d10','font-size':labelSize*.9,'font-weight':750,stroke:'#fffdf3','stroke-width':3,'paint-order':'stroke'},count.toLocaleString('es-CO')));
    }
    node.append(labels,svg('text',{x:787,y:27,fill:'#725742','font-size':15,'text-anchor':'middle','font-weight':750},'N'),svg('path',{d:'M787,62 L787,36 M781,45 L787,36 L793,45',fill:'none',stroke:'#725742','stroke-width':2}));
    const meters=this.zoomLevel>4?200:1000,pixels=meters/111320*this.scale;
    node.append(svg('path',{d:'M25,458 L25,465 L'+(25+pixels)+',465 L'+(25+pixels)+',458',fill:'none',stroke:'#725742','stroke-width':2}),svg('text',{x:25,y:487,fill:'#725742','font-size':13},'≈ '+(meters===1000?'1 km':meters+' m')));
    const selected=zones.find(f=>f.id===this.selected);this.detail.replaceChildren();
    const title=document.createElement('strong'),line=document.createElement('span');
    title.textContent=selected?(selected.displayLabel||selected.label):zones.length+' '+(this.layer==='barrios'?'barrios, sectores y centros poblados':this.layer==='veredas'?'veredas':'comunas')+' de referencia';
    const n=selected?data.counts.get(selected.id)?.length||0:data.mappedIds.size;
    line.textContent=selected?n+' incidentes'+(this.demo?' sintéticos':' identificados')+' en esta vista. '+(n?'Revisa la matriz y sus fuentes.':'Sin registros no significa ausencia de delitos.'):'Selecciona una zona o haz clic en el ranking. “Restablecer capa” encuadra sus zonas; “Todo el territorio” muestra la extensión municipal.';
    this.detail.append(title,line);
    if(selected&&this.layer==='barrios'){const meta=document.createElement('span');meta.textContent=(isCentro(selected)?'Centro poblado · ':'')+(Number(selected.properties?.COMUNA)>0?'Comuna '+selected.properties.COMUNA:'Sin comuna numerada en la fuente')+' · '+(prop(selected.properties,['SUELO','TSUELO','AMBITO'])||'Clasificación no informada');this.detail.append(meta);}
    if(selected&&this.layer==='veredas'){const meta=document.createElement('span');meta.textContent='Vereda de referencia · ámbito rural · delimitación según fuente cartográfica, no certificación de vigencia jurídica.';this.detail.append(meta);}
    if(selected&&n){const ids=document.createElement('span'),records=data.counts.get(selected.id);ids.textContent='ID de muestra: '+records.slice(0,8).map(g=>g.id).join(', ')+(records.length>8?' · y '+(records.length-8)+' más en la matriz.':'');ids.className='field-hint';this.detail.append(ids);}
  }
}
