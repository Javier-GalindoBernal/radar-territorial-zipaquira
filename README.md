# Radar territorial · Zipaquirá

Prototipo público para registrar y explorar incidentes de seguridad reportados, con fuentes trazables y resultados agregados. **Diseño actualizado: 17 de noviembre de 2026. Sin casos reales precargados.**

**Realizado por GLOBAL ANALITIK SAS y QUANTIKA IA SAS — Javier Galindo.**

## Abrir la aplicación

[Radar territorial · Zipaquirá](https://radar-territorial-zipaquira.globalanalitiksas.chatgpt.site).

El sitio tiene acceso público y se puede abrir sin iniciar sesión. Cada visitante conserva sus registros únicamente en su navegador; no existe una base compartida de incidentes. El repositorio permite conservar y ejecutar el código; subir cambios a GitHub no actualiza automáticamente el sitio.

## Ejecutar en tu equipo

Desde la carpeta del repositorio, con Python 3 instalado:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Abre `http://127.0.0.1:8000`. La cartografía está incluida en `dist/`; no requiere instalar paquetes ni configurar claves. Usa un servidor local: abrir directamente `dist/index.html` como archivo puede impedir que el navegador cargue los módulos y las geometrías.

Con Node.js, ejecuta las pruebas:

```sh
node --test tests/*.test.mjs
```

Los registros de trabajo se conservan en el navegador, no en GitHub. La plantilla vacía es el único CSV que se incluye por defecto; exportaciones y datos reales quedan excluidos mediante `.gitignore`.

## Uso

1. Abre el tablero y consulta **Guía del piloto**.
2. Descarga `dist/plantilla-incidentes.csv` o registra los hechos manualmente.
3. Conserva un identificador por publicación y otro por incidente. Varias publicaciones del mismo hecho comparten `incidente_id`.
4. Revisa la fecha del hecho, el lugar y la procedencia. Mantén explícitos los datos desconocidos.
5. Alterna **Comunas** y **Barrios**. Selecciona una zona por clic o buscador; acerca, aleja, desplaza y restablece la vista según necesites. El modo Mapa de calor colorea polígonos por conteo; Territorios usa colores de referencia. El ranking sigue la capa activa.
6. Explora los filtros y revisa los registros sin ubicación. Exporta una copia de respaldo al terminar.

La plantilla CSV está vacía y contiene únicamente los encabezados. Usa las categorías exactas de la guía. Las coordenadas son opcionales y solo describen el lugar del hecho sustentado en la fuente. Si conoces un barrio o comuna del catálogo, usa **Solo zona**: el conteo se representa sobre el polígono sin inventar una coordenada del incidente.

## Cartografía referencial

- **5 comunas**, con edición municipal declarada de 2014 y descripción que cita el Acuerdo Municipal 08 de 2014.
- **191 polígonos de barrios, urbanizaciones y sectores, con 190 nombres distintos**; edición declarada de abril de 2026. Incluyen suelo de expansión y rural y algunos sectores no legalizados según el metadato; no son 191 barrios legalizados.
- Las capas activas son una **republicación de la Universidad de Manizales con fuente municipal declarada**. El original municipal y la vigencia jurídica no se han cotejado. La licencia no está declarada. Las ediciones diferentes no certifican equivalencia espacial completa: esta es cartografía de referencia, no una delimitación jurídica.
- La agregación de barrio a comuna usa solo el atributo `COMUNA` 1–5. Los 25 polígonos con `COMUNA=0` permanecen sin comuna numerada; no forman una sexta comuna.
- `ALTOS DE VILLA MARIA` aparece en comunas 2 y 3. El buscador y las sugerencias añaden la comuna para distinguir ambos polígonos; seleccionar únicamente el que la fuente sustente.
- Procedencia, ediciones, URLs y comprobaciones: `dist/fuentes-zonas.json`. Los colores territoriales y los atributos temáticos de la capa no son cifras de delitos.

## Alcance y datos

- Ingreso manual y CSV. El prototipo no tiene conexión con Facebook ni Croma y no realiza extracción o clasificación automática con IA.
- Almacenamiento de trabajo únicamente en el navegador, mediante `localStorage`; sin sincronización ni respaldo automático entre equipos.
- Demostración ficticia separada del conjunto de trabajo. No usarla como evidencia sobre Zipaquirá ni mezclarla con datos reales.
- Las cantidades representan incidentes identificados en la muestra. No son una estimación de incidencia delictiva ni de riesgo individual.
- Fuentes oficiales, publicaciones de Facebook y medios se distinguen. «Registro oficial» no significa sentencia ni responsabilidad penal demostrada.
- El resumen debe estar anonimizado: sin nombres, documentos, teléfonos, perfiles, placas ni direcciones de víctimas.

## Archivos

| Archivo | Propósito |
|---|---|
| `dist/index.html` | Tablero de consulta y registro. |
| `dist/guia.html` | Guía de recolección, categorías e interpretación. |
| `dist/plantilla-incidentes.csv` | Encabezados para preparar registros. |
| `dist/comunas.geojson`, `dist/barrios.geojson` | Geometría de referencia de las capas activas. |
| `dist/fuentes-zonas.json` | Procedencia y límites de la cartografía. |
| `docs/metodo-piloto.md` | Método del piloto y pendientes de validación. |
| `docs/fuentes/comunas-cundinamarca-2013.geojson` | Copia histórica de cuatro comunas, conservada para trazabilidad; no se usa en el mapa activo. |

El responsable de cada dato se documenta en `responsable_revision`, junto con su fuente y fecha de consulta. El responsable institucional del piloto real está pendiente de designación.

## Referencias

- [Estadística delictiva — Policía Nacional](https://www.policia.gov.co/tipos-descargables/estadistica-delictiva).
- [Recopilación automatizada — Meta](https://about.fb.com/news/2021/04/how-we-combat-scraping/).


## Rediseño y simulación — 17 nov 2026

Interfaz naranja, letra base de 18 px y escudo aportado por el usuario. Lema: “Por la Zipaquirá que soñamos”. Es un piloto independiente y conserva el crédito de sus desarrolladores.

Sin registros de trabajo, abre una simulación de 1.200 hechos únicos, con opciones de 600/1.200/2.400 y regeneración reproducible por semilla. Añade un 5 % de fuentes adicionales del mismo hecho para probar la deduplicación. Las ubicaciones nominales usan barrios reales del catálogo; todos los hechos y puntos son sintéticos. Los puntos se generan por muestreo interior, nunca por centroides. La simulación no escribe en localStorage ni permite exportación. No es evidencia de delitos reales.

El mapa de calor es una representación por polígonos (coropleta): cantidad de incidentes únicos, con escala relativa a la capa y filtros actuales. No representa tasa por población ni densidad puntual. El ranking y el resumen usan el mismo modelo espacial. La vista inicial prioriza las comunas numeradas; Todo el territorio permite explorar la extensión municipal. La matriz pagina en lotes de 60 registros.

## Veredas y San Miguel — 18 nov 2026

El inicio muestra 14 veredas cartográficas de referencia y la extensión municipal. Se mantienen las capas Comunas y Barrios y centros; el acceso Ubicar San Miguel enfoca su polígono. San Miguel no figuraba en los 191 polígonos originales: se incorpora como complemento separado de IDER Cundinamarca, clasificado expresamente como centro poblado rural. No se inventa comuna ni vereda padre.

La fuente de veredas es una republicación académica con origen municipal declarado y edición julio de 2013. La capa de San Miguel tiene edición de datos de 2022 y licencia CC BY 4.0 declarada. Un catálogo modificado en 2026 no acredita datos temáticos de 2026. Fuentes y limitaciones: dist/fuentes-rural.json. No se mezclaron dos catálogos veredales discrepantes.

El filtro Ámbito territorial y tres conteos derivados separan Urbano (incluye expansión), Rural y Sin determinar. La clasificación es referencial según fuente/ubicación, no una certificación jurídica. No se usa COMUNA=0 para deducir ruralidad. Los hechos urbanos se excluyen de la agregación rural. Las capas no deben sumarse entre sí, pues pueden describir los mismos incidentes.

La simulación incorpora hechos sintéticos de veredas y centros poblados, incluido San Miguel, conservando el total de hechos solicitado y el 5 % adicional de fuentes para probar deduplicación.

### Comparación con archivos aportados

El archivo del usuario llamado zipaquira_barrios_comunas_veredas contiene 191 polígonos, todos etiquetados como barrios: coincide exactamente con la capa barrial existente al quitar el atributo auxiliar _capa. No aporta polígonos de comunas, veredas ni San Miguel.

El texto de OpenStreetMap contiene un único límite municipal. Se conservó una copia reparada únicamente con la llave inicial faltante en Inputs del proyecto; no se usa como sustituto de las divisiones internas ni se reemplaza el límite IGAC existente sin cotejo. La aplicación combina capas diferenciadas y documenta la procedencia rural en fuentes-rural.json.

## Versión para la Alcaldía — 18 nov 2026

[Versión Alcaldía](https://radar-territorial-zipaquira.globalanalitiksas.chatgpt.site/alcaldia.html), con la imagen adjunta y el lema “Zipaquirá Cree, Protege y Avanza 2024-2028”. Preserva las funciones y la cartografía, con guía propia y aviso de prototipo/datos sintéticos. Comparte almacenamiento de navegador con la ruta principal. Detalles: docs/version-alcaldia.md.

## Paleta institucional completa — 18 nov 2026

La ruta /alcaldia aplica la paleta de referencia del portal oficial a controles, superficies, tabla, diálogos, guía y mapa. Verde observado #488704, verde claro #A8C98D, blanco, texto oscuro y rojo como acento. Los tonos derivados se ajustan para legibilidad; no se atribuyen como especificaciones normativas de un manual. Mapa y leyenda comparten una escala secuencial blanca/roja para conteos. Detalle: docs/paleta-institucional.md.
