import test from 'node:test';
import assert from 'node:assert/strict';
import { COLUMNS, parseCSV, toCSV, validateRecords, groupIncidents, filterRecords } from '../dist/data.mjs';

const row = (overrides = {}) => ({
  registro_id: 'R-001', incidente_id: 'I-001', fecha_hecho: '2026-11-01',
  fecha_publicacion: '2026-11-02', fecha_consulta: '2026-11-16', delito: 'Hurto a personas',
  zona: 'Sector de ejemplo', tipo_zona: 'Sector', latitud: '', longitud: '',
  precision_ubicacion: 'Solo zona', fuente: 'Facebook', url_fuente: 'https://www.facebook.com/posts/123',
  verificacion: 'Pendiente', resumen: 'Reporte anonimizado.', responsable_revision: 'Analista', ...overrides,
});
test('CSV soporta BOM, punto y coma, comillas escapadas y saltos internos', () => {
  const data = parseCSV('\uFEFFregistro_id;resumen\r\nR1;"Un texto; con ""comillas""\ny otra línea"\r\n');
  assert.equal(data[0].resumen, 'Un texto; con "comillas"\ny otra línea');
  assert.equal(data[0].registro_id, 'R1');
});
test('CSV rechaza comillas abiertas, columnas inconsistentes, duplicadas y externas', () => {
  for (const csv of ['registro_id,resumen\na,"hola', 'registro_id,resumen\na,b,c', 'registro_id,registro_id\na,b', 'registro_id,nombre_persona\na,b', 'registro_id,resumen\na,"hola"x']) assert.throws(() => parseCSV(csv));
});
test('exportación neutraliza fórmulas y conserva coordenadas numéricas negativas', () => {
  const csv = toCSV([row({ resumen: '=HYPERLINK("https://example.com")', longitud: -74.01 })]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const parsed = parseCSV(csv)[0];
  assert.equal(parsed.resumen[0], "'");
  assert.equal(parsed.longitud, '-74.01');
  assert.deepEqual(Object.keys(parsed), [...COLUMNS]);
  for (const value of [' +CMD()', '\t=CMD()', '-2+3', '@SUM(A1)']) assert.equal(parseCSV(toCSV([row({ resumen: value })]))[0].resumen[0], "'");
});
test('registro normalizado y esquema válido', () => {
  const result = validateRecords([row()]);
  assert.equal(result.errors.length, 0);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].latitud, null);
});
test('lote inválido es atómico y fechas imposibles o futuras son rechazadas', () => {
  for (const date of ['2026-02-30', '2026-13-01', '2026-11-17', '01/11/2026']) {
    const result = validateRecords([row(), row({ registro_id: 'R-2', fecha_hecho: date })]);
    assert.ok(result.errors.length);
    assert.deepEqual(result.records, []);
  }
});
test('URLs inseguras o privadas y falso registro oficial son rechazados', () => {
  for (const url of ['javascript:alert(1)', 'https://user:pass@example.com', 'http://localhost/x', 'http://127.0.0.1/x', 'http://192.168.1.1/x', '']) assert.ok(validateRecords([row({ url_fuente: url })]).errors.length);
  assert.ok(validateRecords([row({ verificacion: 'Registro oficial' })]).errors.length);
});
test('coordenadas parciales, fuera de alcance o un centroide etiquetado Solo zona son rechazados', () => {
  for (const extra of [
    { latitud: 5.02 },
    { latitud: 5.02, longitud: -74.01 },
    { latitud: 50, longitud: -74.01, precision_ubicacion: 'Punto verificado' },
    { latitud: 'abc', longitud: -74.01, precision_ubicacion: 'Aproximada' },
  ]) assert.ok(validateRecords([row(extra)]).errors.length);
  const valid = validateRecords([row({ latitud: 5.02, longitud: -74.01, precision_ubicacion: 'Aproximada' })]);
  assert.equal(valid.errors.length, 0);
});
test('sin zona se normaliza a Sin ubicar y conserva desconocido', () => {
  const result = validateRecords([row({ zona: '', precision_ubicacion: 'Sin ubicar' })]);
  assert.equal(result.errors.length, 0);
  assert.equal(result.records[0].tipo_zona, 'Sin ubicar');
});
test('IDs repetidos son error y publicaciones de un incidente no inflan su conteo', () => {
  assert.ok(validateRecords([row(), row()]).errors.some(e => /repetido/.test(e.message)));
  const result = validateRecords([row(), row({ registro_id: 'R-2', url_fuente: 'https://example.com/noticia' })]);
  const groups = groupIncidents(result.records);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].records.length, 2);
});
test('fuentes que ubican el mismo incidente en sitios distintos no generan punto', () => {
  const result = validateRecords([
    row({ latitud: 5.02, longitud: -74.01, precision_ubicacion: 'Punto verificado' }),
    row({ registro_id: 'R-2', zona: 'Otra zona', latitud: 5.03, longitud: -74.01, precision_ubicacion: 'Punto verificado' }),
  ]);
  const group = groupIncidents(result.records)[0];
  assert.equal(group.conflict, true);
  assert.equal(group.latitud, null);
  assert.equal(group.longitud, null);
  assert.equal(group.zona, '');
});
test('sin fecha del hecho queda fuera de un filtro temporal', () => {
  const records = validateRecords([row({ fecha_hecho: '' })]).records;
  assert.equal(filterRecords(records).length, 1);
  assert.equal(filterRecords(records, { from: '2026-08-19', to: '2026-11-16' }).length, 0);
  assert.equal(filterRecords(validateRecords([row()]).records, { fuente: 'Oficial' }).length, 0);
});
