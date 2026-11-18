# Paleta de la versión para la Alcaldía

Referencia: https://www.zipaquira-cundinamarca.gov.co/ . Colores observados en la interfaz del portal oficial el 18 de noviembre de 2026: fondo del elemento Inicio, RGB(72,135,4), #488704; borde de navegación y elementos secundarios, RGB(168,201,141), #A8C98D; texto oscuro #434343 y blanco #FFFFFF.

Estos son valores observados de implementación web, no una certificación de especificaciones normativas de un manual municipal. Se conserva el rojo del identificador como familia de acento; los rojos y verdes derivados elegidos para la interfaz se ajustan para mantener legibilidad.

La paleta cubre encabezado, controles, filtros, tarjetas, tablas, formularios, diálogos, estados, avisos, ranking, mapa, leyenda y guía. El mapa usa una escala secuencial blanca/roja para conteos, no para tasas ni riesgo individual. La leyenda y el SVG comparten las mismas siete variables de color. Las variables tienen fallbacks para que la ruta principal conserve su aspecto previo.

Archivo de tema: dist/alcaldia.css. Variables del mapa: --map-heat-0 a --map-heat-6, --map-empty, --map-neutral-0 a --map-neutral-4 y tokens de textos/bordes/fondo. El cuerpo institutional activa el tema; la guía usa institutional guide.

Contrastes texto/fondo comprobados: botón primario 6,51; texto principal 13,48; texto secundario 6,49; alerta 7,84. La lógica y cartografía se conservan; 35 pruebas de regresión correctas en la copia aplicada.
