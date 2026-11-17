# Método del piloto de seguridad territorial · Zipaquirá

**Corte del diseño:** 16 de noviembre de 2026. **Estado:** prototipo sin casos reales cargados. **Responsable del dato:** quien realiza y documenta la revisión de cada fuente; pendiente de designación para el piloto real.

## Propósito y alcance

Identificar la distribución de incidentes de seguridad reportados en una muestra documentada de fuentes públicas. La unidad analítica es el **incidente identificado**, no la publicación ni la persona. El producto apoya la formulación de preguntas para contrastar en territorio; no es un registro oficial de delitos, un sistema de predicción ni una estimación del riesgo individual.

El prototipo recibe registros manuales y archivos CSV aportados por el usuario. No tiene conexión con Facebook ni Croma, no recoge información automáticamente y no clasifica personas. El procesamiento inicial es manual: la aplicación organiza los registros y sus agregados.

## Piloto mínimo

| Decisión | Regla inicial |
|---|---|
| Ámbito | Municipio de Zipaquirá; la zona se registra solo cuando la fuente ubica el hecho. |
| Tema inicial | Hurto a personas. Los demás tipos se pueden incorporar como series separadas. |
| Ventana | Últimos 90 días. Para el corte del diseño: 19 de agosto a 16 de noviembre de 2026, ambos incluidos. |
| Muestra | 50–100 publicaciones públicas seleccionadas con reglas registradas. Este tamaño no garantiza representatividad. |
| Fuentes | Páginas comunitarias, medios locales, publicaciones públicas y datos oficiales a los que se tenga acceso autorizado. |
| Responsable | Un revisor registra su nombre de rol o código en `responsable_revision`; no se requiere identificar a quien publicó. |
| Entrega | Matriz de registros, incidentes deduplicados, distribución por zonas, vacíos de ubicación y estado de verificación. |

## Recolección y revisión

1. **Fijar la cobertura.** Registrar las páginas consultadas, las fechas de consulta, el período cubierto y las reglas de inclusión. No seleccionar únicamente publicaciones virales. Documentar las fuentes que no pudieron revisarse.
2. **Leer la publicación original.** Conservar su URL y la fecha de consulta. Una captura sin enlace, fecha y procedencia no reemplaza la trazabilidad. Los enlaces pueden dejar de estar disponibles; una afirmación que no se pueda revisar se mantiene pendiente.
3. **Separar las fechas.** `fecha_hecho` es cuando habría ocurrido el incidente; `fecha_publicacion` es cuando se publicó. Si solo se conoce la segunda, dejar vacía la primera. Resolver expresiones como «ayer» únicamente si la fecha de publicación y el contexto permiten una interpretación inequívoca; documentar la revisión en el resumen.
4. **Anonimizar.** Escribir una síntesis del evento. Omitir nombres, documentos, teléfonos, perfiles, placas y direcciones de víctimas. Excluir acusaciones dirigidas contra individuos identificables.
5. **Ubicar el hecho.** Registrar el lugar del incidente, nunca la residencia inferida de quien publica. Pertenecer a un grupo local no acredita residencia ni localización del hecho. El piloto dispone de un catálogo cartográfico referencial de barrios y comunas; cotejar su edición y procedencia y validar los nombres con la fuente territorial vigente antes de una entrega institucional.
6. **Evitar precisión ficticia.** Las coordenadas son opcionales. Si la fuente solo identifica una zona del catálogo, seleccionar `Solo zona`: el conteo se representa sobre su polígono, sin crear una coordenada del incidente. No ubicar un incidente en el centro de un barrio para fingir una localización puntual. Si no hay lugar identificable, usar `Sin ubicar`. Conservar aparte los casos sin coordenadas y los casos sin zona reconocida.
7. **Deduplicar.** Cada publicación tiene un `registro_id` único. Si varias fuentes describen el mismo hecho, asignarles el mismo `incidente_id`. Comparar lugar, fecha, modalidad y contexto; no unir hechos distintos solo porque se parecen. La coincidencia se valida manualmente.
8. **Resolver contradicciones.** Si las fuentes difieren sobre lugar, fecha o tipo de incidente, mantener la discrepancia visible y revisar antes de ubicar o interpretar el caso. No escoger el dato más conveniente.
9. **Documentar el estado.** `Pendiente` significa que falta contraste; `Contrastado` significa que el revisor documentó el contraste, no que exista prueba judicial. Dos publicaciones que copian la misma noticia no son dos confirmaciones independientes. `Registro oficial` se usa únicamente cuando la fuente del registro es oficial; no acredita responsabilidad penal ni sentencia.
10. **Exportar y revisar.** Guardar una copia de respaldo de los registros de trabajo. Revisar una muestra de las filas contra las fuentes y reportar las limitaciones antes de compartir cualquier resultado.

## Diccionario de la matriz

| Campo | Qué registrar |
|---|---|
| `registro_id` | Identificador único de la publicación o registro, por ejemplo `R0001`. |
| `incidente_id` | Identificador del hecho; puede repetirse entre fuentes que describan el mismo incidente. |
| `fecha_hecho` | Fecha del incidente en `AAAA-MM-DD`; vacía si no se conoce. |
| `fecha_publicacion` | Fecha de la publicación en `AAAA-MM-DD`, si se conoce. |
| `fecha_consulta` | Fecha real de consulta en `AAAA-MM-DD`. |
| `delito` | Tipo de incidente reportado, usando el catálogo del piloto; su clasificación no es una calificación judicial. |
| `zona`, `tipo_zona` | Nombre del lugar y nivel territorial, únicamente con base en la fuente y la revisión. |
| `latitud`, `longitud` | Par de coordenadas del lugar del hecho, opcional. No completar por aproximación automática a un centroide. |
| `precision_ubicacion` | Precisión sustentada en la fuente y en la revisión. |
| `fuente` | Categoría de procedencia. |
| `url_fuente` | URL pública `http://` o `https://`, sin credenciales incrustadas. |
| `verificacion` | Estado documentado del contraste. |
| `resumen` | Síntesis anónima del incidente y observaciones relevantes para interpretar la fuente. |
| `responsable_revision` | Rol o código del revisor, por ejemplo «Analista 1». |

### Valores admitidos

- **Delito:** `Hurto a personas`, `Hurto a vehículos`, `Hurto a comercio`, `Lesiones personales`, `Otro incidente`.
- **Tipo de zona:** `Barrio`, `Comuna`, `Vereda`, `Sector`, `Sin ubicar`.
- **Precisión:** `Punto verificado`, `Aproximada`, `Solo zona`, `Sin ubicar`.
- **Fuente:** `Facebook`, `Oficial`, `Medio local`, `Reporte voluntario`.
- **Verificación:** `Pendiente`, `Contrastado`, `Registro oficial`.

## Interpretación

| Resultado | Interpretación defendible |
|---|---|
| Más publicaciones | Más publicaciones observadas en la cobertura revisada; no necesariamente más incidentes. |
| Más incidentes deduplicados | Más hechos identificados en la muestra; no equivale a incidencia real o total de delitos. |
| Zona sin reportes | No se observaron registros en la muestra; no demuestra ausencia de problemas. |
| Mapa de puntos | Ubicaciones sustentadas disponibles. Su distribución depende de cobertura, denuncia y precisión geográfica. |
| Comparación temporal | Requiere períodos y cobertura comparables; distinguir cambios en los reportes de cambios en ocurrencia real. |

No sumar capas oficiales, Facebook y medios como si fueran hechos distintos: pueden describir el mismo evento. Las fuentes oficiales municipales sin barrio o coordenadas sirven como contexto municipal; no permiten construir una distribución intramunicipal. Los registros de investigación o denuncia tampoco representan por sí solos delitos judicialmente probados.

## Mapa y catálogo territorial de referencia

El mapa aparece aun sin incidentes. Permite alternar **Comunas** y **Barrios**, seleccionar un territorio mediante clic o buscador, acercar, alejar, desplazar y restablecer la vista. Los colores iniciales distinguen territorios, **no delitos ni nivel de inseguridad**.

| Capa activa | Contenido y edición declarada |
|---|---|
| Comunas | 5 polígonos; fuente municipal declarada con última actualización 2014 y descripción que cita el Acuerdo Municipal 08 de 2014. |
| Barrios | 191 polígonos y 190 nombres distintos de barrios, urbanizaciones y sectores; versión declarada 3.0, abril de 2026. Incluye suelo urbano, expansión y rural, además de algunos sectores de conocimiento popular no legalizados según el metadato. No equivale a 191 barrios legalizados. |

Ambas capas activas proceden de una **republicación académica de la Universidad de Manizales con fuente municipal declarada**. No se ha cotejado el original municipal ni verificado la vigencia jurídica actual. La licencia no está declarada en el elemento consultado; no se presume una licencia de otra publicación. Las dos ediciones no certifican equivalencia espacial completa entre sí. Utilizar como cartografía referencial, no como delimitación jurídica. La procedencia, las URLs, las ediciones y las comprobaciones están documentadas en [`fuentes-zonas.json`](../dist/fuentes-zonas.json).

### Asignación y conteo territorial

- Con `Solo zona`, el nombre debe corresponder al catálogo seleccionado. El número mostrado sobre el polígono es un conteo agregado de incidentes relacionados con esa zona; no localiza cada hecho en el punto donde se dibuja la etiqueta.
- Un barrio se agrega a una comuna únicamente mediante el atributo `COMUNA` con valor 1, 2, 3, 4 o 5. `COMUNA=0` no es una sexta comuna y no permite asignación a una comuna numerada. Hay 25 polígonos en esta situación; se conservan sin asignación.
- El nombre `ALTOS DE VILLA MARIA` corresponde a dos polígonos, en comunas 2 y 3. El buscador y las sugerencias los distinguen con el sufijo de comuna. Seleccionar el que la fuente permita sustentar; no elegir arbitrariamente entre ambos.
- Los nombres territoriales no son identificadores únicos de polígonos. La republicación usa `OBJECTID` como clave de los barrios. Los casos ambiguos o sin correspondencia conservan su limitación de ubicación.
- La cartografía solo aporta geometría y atributos territoriales. Los atributos temáticos del servicio de origen, como `COUNT_`, no son incidentes del piloto ni se utilizan para contarlos.

## Almacenamiento y demostración

Los registros de trabajo se guardan en el navegador que se utiliza. No hay sincronización ni respaldo automático entre equipos; borrar los datos del navegador puede eliminarlos. Exportar la matriz después de cada sesión y guardarla bajo control del responsable del piloto.

La demostración usa ejemplos ficticios identificados como tales y se mantiene separada de los datos de trabajo. No incorporarla a cifras reales, respaldos operativos ni conclusiones territoriales. Los ejemplos no deben asociar acusaciones a barrios reales.

## Fuentes del método

Consultadas para el diseño el 16 de noviembre de 2026:

- [Policía Nacional — estadística delictiva](https://www.policia.gov.co/tipos-descargables/estadistica-delictiva): punto de entrada a la información estadística oficial; revisar metadatos y resolución territorial de cada archivo antes de usarlo.
- [Meta — How We Combat Scraping](https://about.fb.com/news/2021/04/how-we-combat-scraping/): Meta explica que la recopilación automatizada requiere su autorización. El piloto utiliza captura manual y archivos aportados por el usuario.

## Pendientes para operar con datos reales

- [ ] Designar responsable del dato y revisor.
- [ ] Validar el catálogo territorial y sus fuentes vigentes.
- [ ] Documentar fuentes públicas, período y cobertura de la muestra.
- [ ] Verificar acceso autorizado antes de plantear cualquier automatización.
- [ ] Revisar 50–100 publicaciones, anonimizar y deduplicar.
- [ ] Contrastar la interpretación con información institucional o validación territorial.

