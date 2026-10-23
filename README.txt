CHERCHA AZUL — PROYECTO WEB + BACKEND DE ESTADÍSTICAS

La carpeta backend contiene un servicio Node.js preparado para desplegar en Render.

PRUEBA LOCAL DEL BACKEND
1. Abre una terminal en la carpeta backend.
2. Ejecuta: npm start
3. Abre http://localhost:3000/health
4. Abre http://localhost:3000/api/stats

CONEXIÓN DE LA WEB
En config.js, statsApiUrl debe contener la URL pública de Render terminada en /api/stats. No rellenes ese campo con localhost cuando publiques la web.

DESPLIEGUE EN RENDER
Consulta backend/README.md para los pasos. Si todo el proyecto está en GitHub, selecciona backend como Root Directory, npm install como Build Command y npm start como Start Command.

DATOS
El backend consulta MLB Stats API y filtra estadísticas identificadas como LIDOM y Tigres del Licey. Es una fuente no oficial; contrasta los resultados con LIDOM. Los datos no disponibles no se inventan. El roster activo no se consulta; solo se muestran los jugadores que tengan estadísticas en la respuesta de la temporada.

La comunidad (chat, predicciones y mensajes) todavía usa localStorage, por lo que no comparte publicaciones entre diferentes visitantes.

RENOVACIÓN VISUAL CHERCHAAZULL
- La fotografía del jugador está en assets/images/licey-jugador.jpeg.
- La portada usa esa imagen como fondo del área hero con degradado oscuro y diseño adaptable.
- config.js apunta a https://chercha-azul.onrender.com/api/stats.
- El frontend mantiene las funciones originales de estadísticas, roster, predicciones y muro local.
- Nota: los mensajes de comunidad siguen guardándose localmente en cada navegador; para chat compartido se necesita base de datos.


Actualización visual: navegación con iconos para Inicio, Noticias, Estadísticas, Equipo, Comunidad y Ruta; accesos rápidos en inicio; apartado Ruta y enlaces existentes conservados.


ACTUALIZACIÓN DE NAVEGACIÓN: El apartado Equipo contiene el récord, próximo juego, abridor probable, último resultado y tabla de posiciones. Estadísticas queda dedicado a bateadores y lanzadores. Próximos partidos está dentro de Equipo.
