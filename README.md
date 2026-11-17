# Radar territorial · Zipaquirá

Prototipo público para registrar y explorar incidentes de seguridad reportados, con fuentes trazables y resultados agregados. **Corte del diseño: 16 de noviembre de 2026. Sin casos reales precargados.**

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
node --test tests/data.test.mjs tests/territory.test.mjs
```

Los registros de trabajo se conservan en el navegador, no en GitHub. La plantilla vacía es el único CSV que se incluye por defecto; exportaciones y datos reales quedan excluidos mediante `.gitignore`.

## Uso

1. Abre el tablero y consulta **Guía del piloto**.
2. Descarga `dist/plantilla-incidentes.csv` o registra los hechos manualmente.
3. Conserva un identificador por publicación y otro por incidente. Varias publicaciones del mismo hecho comparten `incidente_id`.
4. Revisa la fecha del hecho, el lugar y la procedencia. Mantén explícitos los datos desconocidos.
5. Alterna **Comunas** y **Barrios**. Selecciona una zona por clic o buscador; acerca, aleja, desplaza y restablece la vista según necesites. El mapa se muestra sin incidentes: los colores iniciales distinguen territorios, no delitos.
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

