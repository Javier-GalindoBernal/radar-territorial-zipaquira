import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateDemoRecords } from '../dist/demo.mjs';
import { prepare, contains, model } from '../dist/territory.mjs';
import { ENUMS, validateRecords, groupIncidents, filterRecords } from '../dist/data.mjs';

const read = name => JSON.parse(readFileSync(new URL(`../dist/${name}`, import.meta.url)));
const barrios = prepare(read('barrios.geojson'), 'barrios'), comunas = prepare(read('comunas.geojson'), 'comunas');
const municipal = read('limite-zipaquira.geojson');
const config = { barrios, comunas, today: '2026-11-17', count: 1200, seed: 1 };
const generated = generateDemoRecords(config);
const validated = validateRecords(generated, { demo: true, today: config.today });

test('el escenario es reproducible por semilla y cambia de concentración al simular', () => {
  assert.deepEqual(generateDemoRecords(config), generated);
  const second = generateDemoRecords({ ...config, seed: 2 });
  assert.notDeepEqual(second, generated);
  const top = rows => [...model(groupIncidents(rows), { barrios, comunas }, 'barrios', municipal).counts].sort((a, b) => b[1].length - a[1].length)[0][0];
  assert.notEqual(top(second), top(generated));
});

test('1200 hechos generan 1260 fuentes sin multiplicar incidentes ni crear conflictos', () => {
  assert.equal(generated.length, 1260);
  assert.equal(new Set(generated.map(r => r.registro_id)).size, 1260);
  const incidents = groupIncidents(validated.records);
  assert.equal(incidents.length, 1200);
  assert.equal(incidents.filter(g => g.records.length === 2).length, 60);
  assert.equal(incidents.filter(g => g.conflict).length, 0);
  assert.ok(generated.every(r => r.incidente_id.startsWith('DEMO-') && r.url_fuente === '' && r.resumen.includes('DATOS SINTÉTICOS')));
});

test('la simulación es válida y conserva tipos, fechas y procedencias coherentes', () => {
  assert.deepEqual(validated.errors, []);
  assert.deepEqual(new Set(generated.map(r => r.delito)), new Set(ENUMS.delito));
  assert.equal(new Set(generated.map(r => r.fuente)).size, 3);
  assert.ok(generated.every(r => r.fecha_hecho >= '2026-08-20' && r.fecha_hecho <= config.today && r.fecha_hecho <= r.fecha_publicacion && r.fecha_publicacion <= r.fecha_consulta));
  assert.ok(generated.every(r => r.verificacion !== 'Registro oficial' || r.fuente === 'Oficial'));
});

test('los puntos sintéticos están dentro del barrio y los faltantes no se completan con centroides', () => {
  const unique = validated.records.slice(0, config.count);
  const points = unique.filter(r => r.precision_ubicacion === 'Punto verificado');
  const unlocated = unique.filter(r => r.precision_ubicacion === 'Sin ubicar');
  assert.ok(points.length > config.count * .18 && points.length < config.count * .32);
  assert.ok(unlocated.length > config.count * .025 && unlocated.length < config.count * .09);
  for (const r of points) {
    const zone = barrios.find(b => (b.displayLabel || b.label) === r.zona);
    assert.ok(zone && contains(zone, r.longitud, r.latitud));
  }
  assert.ok(unique.filter(r => r.precision_ubicacion !== 'Punto verificado').every(r => r.latitud === null && r.longitud === null));
  assert.ok(unlocated.every(r => r.zona === '' && r.tipo_zona === 'Sin ubicar'));
});

test('ambas capas cuentan hechos únicos y los filtros recalculan el conjunto', () => {
  const groups = groupIncidents(validated.records);
  for (const layer of ['barrios', 'comunas']) {
    const result = model(groups, { barrios, comunas }, layer, municipal);
    assert.equal([...result.counts.values()].reduce((sum, records) => sum + records.length, 0), result.mappedIds.size);
    assert.ok(result.mappedIds.size > 1000 && result.mappedIds.size < 1200);
  }
  const filtered = filterRecords(validated.records, { delito: ENUMS.delito[0], from: '2026-11-01' });
  assert.ok(filtered.length > 0 && filtered.length < validated.records.length);
  assert.ok(filtered.every(r => r.delito === ENUMS.delito[0] && r.fecha_hecho >= '2026-11-01'));
  const result = model(groupIncidents(filtered), { barrios, comunas }, 'barrios', municipal);
  assert.ok(result.mappedIds.size < model(groups, { barrios, comunas }, 'barrios', municipal).mappedIds.size);
});

test('límites de escenario, cartografía ausente y fecha inválida se manejan expresamente', () => {
  assert.equal(groupIncidents(generateDemoRecords({ ...config, count: 2400 })).length, 2400);
  assert.deepEqual(generateDemoRecords({ ...config, barrios: [] }), []);
  assert.throws(() => generateDemoRecords({ ...config, count: 2401 }), /2400/);
  assert.throws(() => generateDemoRecords({ ...config, today: '2026-02-30' }), /fecha de corte/);
});
