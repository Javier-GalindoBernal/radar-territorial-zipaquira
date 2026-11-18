import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { prepare, model, classifyScope, within, TerritoryMap } from '../dist/territory.mjs';
const fc=features=>({type:'FeatureCollection',features});
const box=(name,x,y,w=1,h=1,properties={})=>({type:'Feature',properties:{NOMBRE:name,...properties},geometry:{type:'Polygon',coordinates:[[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]]}});
const group=(extra={})=>({id:'HECHO-1',zona:'El Cedro',tipo_zona:'Vereda',precision_ubicacion:'Solo zona',latitud:null,longitud:null,conflict:false,...extra});
const veredas=prepare(fc([box('El Cedro',0,0,5,5),box('La Granja',5,0,5,5)]),'veredas');
const municipal=fc([box('Municipio',0,0,10,5)]);

test('veredas reconoce nombre minúsculo y alias con prefijos sin unir homónimos',()=>{
  const first={...box('',0,0),properties:{nombre:'EL CEDRO'}};
  const areas={veredas:prepare(fc([first,box('EL CEDRO',2,0)]),'veredas')};
  assert.equal(areas.veredas.length,2);
  assert.equal(model([group({zona:'Vda. El Cedro'})],areas,'veredas').mappedIds.size,0);
  assert.equal(model([group({zona:areas.veredas[0].displayLabel})],areas,'veredas').mappedIds.size,1);
  assert.equal(model([group({zona:'Vereda La Granja'})],{veredas},'veredas').mappedIds.size,1);
});

test('un hecho por vereda o punto interior se cuenta una vez y los contradictorios quedan fuera',()=>{
  const nominal=group(),located=group({id:'HECHO-2',zona:'',tipo_zona:'Sin ubicar',precision_ubicacion:'Punto verificado',longitud:8,latitud:2});
  const result=model([nominal,nominal,located,group({id:'HECHO-3',conflict:true})],{veredas},'veredas',municipal);
  assert.equal(result.mappedIds.size,2);
  assert.equal([...result.counts.values()].reduce((n,rows)=>n+rows.length,0),2);
  assert.equal(model([group({precision_ubicacion:'Punto verificado',longitud:12,latitud:2})],{veredas},'veredas',municipal).mappedIds.size,0);
});

test('barrio solo pasa a vereda con relación explícita o contención completa inequívoca',()=>{
  const inside=box('Interior',1,1,.5,.5,{SUELO:'RURAL'});
  const crossing=box('Entre dos',4,1,2,.5);
  const declared=box('Declarado',4,1,2,.5,{VEREDA:'LA GRANJA'});
  const cp=box('San Miguel',2,2,.5,.5,{TIPO_ZONA:'Centro poblado',AMBITO:'Rural'});
  const barrios=prepare(fc([inside,crossing,declared,cp]),'barrios'),areas={barrios,veredas};
  const run=(zona,tipo_zona='Barrio')=>model([group({zona,tipo_zona})],areas,'veredas');
  assert.equal(run('Interior').mappedIds.size,1);
  assert.equal(run('Entre dos').mappedIds.size,0);
  assert.equal(run('Declarado').counts.get(veredas[1].id).length,1);
  assert.equal(run('San Miguel','Centro poblado').mappedIds.size,0);
  assert.equal(run('San Miguel','Barrio').mappedIds.size,0);
});

test('contención revisa segmentos en polígonos cóncavos y huecos, no solo vértices ni centroides',()=>{
  const concave={type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[0,0],[4,0],[4,4],[3,4],[3,1],[1,1],[1,4],[0,4],[0,0]]]}};
  const bridge=box('Puente',.5,2,3,.5);
  assert.equal(within(bridge,concave),false);
  const hole=box('Con hueco',0,0,5,5);
  hole.geometry.coordinates.push([[2,2],[3,2],[3,3],[2,3],[2,2]]);
  assert.equal(within(box('Encierra hueco',1,1,3,3),hole),false);
  assert.equal(within(box('Interior válido',.2,.2,.8,.8),hole),true);
  assert.equal(within(box('Límite compartido',0,0,1,1),box('Padre',0,0,5,5)),true);
});

test('ámbito conserva Rural/Urbano/Sin determinar y no usa COMUNA=0 como rural',()=>{
  const barrios=prepare(fc([
    box('San Miguel',6,1,1,1,{TIPO_ZONA:'Centro poblado',AMBITO:'Rural'}),
    box('Centro',1,1,1,1,{SUELO:'URBANO',COMUNA:1}),
    box('Expansión',2,1,1,1,{SUELO:'EXPANSIÓN URBANA',COMUNA:0}),
    box('Sin clase',3,1,.5,.5,{COMUNA:0}),
    box('Rural protegido',7,3,.5,.5,{SUELO:'RURAL - PROTECCIÓN',COMUNA:0})
  ]),'barrios');
  const comunas=prepare(fc([box('Comuna 1',0,0,4,4)]),'comunas'),areas={barrios,veredas,comunas};
  assert.equal(classifyScope(group(),areas,municipal),'Rural');
  assert.equal(classifyScope(group({zona:'Centro',tipo_zona:'Barrio'}),areas,municipal),'Urbano');
  assert.equal(classifyScope(group({zona:'Expansión',tipo_zona:'Barrio'}),areas,municipal),'Urbano');
  assert.equal(classifyScope(group({zona:'Sin clase',tipo_zona:'Barrio'}),areas,municipal),'Sin determinar');
  assert.equal(classifyScope(group({zona:'Rural protegido',tipo_zona:'Barrio'}),areas,municipal),'Rural');
  assert.equal(classifyScope(group({zona:'San Miguel',tipo_zona:'Centro poblado'}),areas,municipal),'Rural');
  assert.equal(classifyScope(group({zona:'San Miguel',tipo_zona:'Barrio'}),areas,municipal),'Rural');
  assert.equal(classifyScope(group({zona:'Ausente'}),areas,municipal),'Sin determinar');
  assert.equal(classifyScope(group({conflict:true}),areas,municipal),'Sin determinar');
  assert.equal(classifyScope(group({zona:'',precision_ubicacion:'Punto verificado',longitud:8,latitud:2}),areas,municipal),'Rural');
  assert.equal(classifyScope(group({zona:'',precision_ubicacion:'Punto verificado',longitud:12,latitud:2}),areas,municipal),'Sin determinar');
});

test('San Miguel conserva clasificación de centro poblado y no adquiere comuna ficticia',()=>{
  const barrios=prepare(fc([box('SAN MIGUEL',6,1,1,1,{TIPO_ZONA:'Centro poblado',AMBITO:'Rural',COMUNA:0})]),'barrios');
  const areas={barrios,veredas,comunas:prepare(fc([box('Comuna 1',0,0,4,4)]),'comunas')};
  for(const tipo_zona of ['Barrio','Centro poblado'])assert.equal(model([group({zona:'San Miguel',tipo_zona})],areas,'barrios').mappedIds.size,1);
  assert.match(barrios[0].displayLabel,/Centro poblado/);
  assert.equal(model([group({zona:'San Miguel',tipo_zona:'Barrio'})],areas,'comunas').mappedIds.size,0);
});

test('encuadre rural usa municipio completo y barrios incluye San Miguel fuera de comunas',()=>{
  const holder=Object.create(TerritoryMap.prototype);
  holder.layer='veredas';holder.full=false;holder.data={zones:veredas};holder.municipal=municipal;
  assert.deepEqual(holder.baseExtent(),[0,0,10,5]);
  holder.layer='barrios';holder.data={zones:prepare(fc([box('Urbano',0,0),box('San Miguel',8,2,1,1,{TIPO_ZONA:'Centro poblado',AMBITO:'Rural',COMUNA:0})]),'barrios')};
  assert.deepEqual(holder.baseExtent(),[0,0,9,3]);
});

const realPath=new URL('../dist/veredas.geojson',import.meta.url);
test('geometría rural real se prepara con 14 veredas sin fabricar comunas',{skip:!existsSync(realPath)},()=>{
  const path=realPath;
  const real=prepare(JSON.parse(readFileSync(path)),'veredas');
  assert.equal(real.length,14);
  assert.ok(real.every(v=>v.label&&!v.label.includes('sin nombre')));
  assert.ok(real.some(v=>v.aliases.includes('ELCEDRO')));
});

test('una vereda histórica superpuesta a la cabecera no absorbe hechos urbanos',()=>{
  const centro=prepare(fc([box('Centro',0,0,10,5)]),'veredas');
  const barrios=prepare(fc([box('Barrio urbano',1,1,1,1,{SUELO:'URBANO',COMUNA:1})]),'barrios');
  const comunas=prepare(fc([box('Comuna 1',0,0,4,4)]),'comunas');
  const areas={barrios,comunas,veredas:centro};
  const point=group({id:'URBANO-P',zona:'',tipo_zona:'Sin ubicar',precision_ubicacion:'Punto verificado',longitud:1.5,latitud:1.5});
  const nominal=group({id:'URBANO-Z',zona:'Barrio urbano',tipo_zona:'Barrio'});
  const rural=group({id:'RURAL-P',zona:'',tipo_zona:'Sin ubicar',precision_ubicacion:'Punto verificado',longitud:8,latitud:2});
  const result=model([point,nominal,rural],areas,'veredas',municipal);
  assert.equal(classifyScope(point,areas,municipal),'Urbano');
  assert.equal(classifyScope(nominal,areas,municipal),'Urbano');
  assert.deepEqual([...result.mappedIds],['RURAL-P']);
});

test('un centro poblado declarado con punto interior prevalece sobre sectores superpuestos',()=>{
  const barrios=prepare(fc([
    box('Sector anterior',0,0,5,5,{SUELO:'URBANO'}),
    box('SAN MIGUEL',1,1,2,2,{TIPO_ZONA:'Centro poblado',AMBITO:'Rural',SUELO:'RURAL'})
  ]),'barrios'),areas={barrios};
  const matching=group({zona:'San Miguel',tipo_zona:'Centro poblado',precision_ubicacion:'Punto verificado',longitud:2,latitud:2});
  const result=model([matching],areas,'barrios',municipal);
  assert.equal(result.counts.get(barrios[1].id).length,1);
  assert.equal(result.counts.get(barrios[0].id).length,0);
  assert.equal(classifyScope(matching,areas,municipal),'Rural');
  const outside=group({...matching,zona:'San Miguel',longitud:.5,latitud:.5});
  assert.equal(model([outside],areas,'barrios',municipal).counts.get(barrios[0].id).length,1);
  assert.equal(classifyScope(outside,areas,municipal),'Urbano');
  const unnamed=group({...matching,zona:''});
  assert.equal(model([unnamed],areas,'barrios',municipal).mappedIds.size,0);
  assert.equal(classifyScope(unnamed,areas,municipal),'Sin determinar');
});

test('el mapa rural tiene encuadre válido antes de recibir la cartografía',()=>{
  const bounds=TerritoryMap.prototype.baseExtent.call({layer:'veredas',full:false,data:{zones:[]},municipal:null});
  assert.equal(bounds.length,4);
  assert.ok(bounds.every(Number.isFinite));
  assert.ok(bounds[2]>bounds[0]&&bounds[3]>bounds[1]);
});
