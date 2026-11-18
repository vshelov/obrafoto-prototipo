# Prototipo funcional básico: registro de avance de obra con fotos

> Instrucciones para Claude Code. Léelo completo antes de escribir código.

## 1. Contexto
Proyecto universitario (INACAP, Innovación y Emprendimiento III). Desafío: reducir el tiempo y la subjetividad del control de avance físico en obras de construcción, para profesionales de terreno y oficina técnica.

La propuesta de valor es una app móvil donde el profesional:
1. toma o sube una foto de una partida de obra,
2. la foto queda asociada automáticamente a fecha, ubicación y partida,
3. la app propone un % de avance y lo compara con lo planificado,
4. el profesional valida o corrige el porcentaje antes de que sea el dato oficial,
5. se ve el historial de fotos y una curva de avance (plan vs real).

Ya existe una landing de muestra (maqueta visual) en la raíz del repositorio: `index.html`, `styles.css`, `app.js`. **No la modifiques ni la rompas.** El prototipo va en una carpeta nueva `app/` y se abre en `/app/`.

## 2. Objetivo del prototipo
Demostrar el flujo completo de punta a punta, de forma simple y funcional:
**subir foto, guardarla, estimar, validar, ver historial y curva.**
Es un prototipo de muestra: prioriza que funcione y se entienda, no que sea perfecto.

## 3. Alcance
**Sí incluye**
- Subir una foto desde el celular (cámara) o desde archivos.
- Guardar la foto y sus datos de forma permanente.
- Asociar automáticamente fecha/hora y ubicación (GPS del navegador, si el usuario lo permite).
- Elegir la partida de una lista fija.
- Estimación de avance **simulada** (ver sección 6).
- Validación del profesional con un control (slider) y botón Confirmar.
- Historial de registros con foto, partida, fecha, ubicación y avance validado.
- Curva de avance simple (plan vs real) con los datos guardados.

**No incluye**
- Visión artificial real (la estimación es simulada y debe decirlo en pantalla).
- Login de usuarios, roles, multiobra, notificaciones, exportar a Excel/PDF.
- Integración con Gantt real.

## 4. Stack (sin paso de compilación, apto para Vercel gratis)
- **Frontend:** HTML + CSS + JavaScript puro, en `app/index.html`, `app/styles.css`, `app/app.js`. Móvil primero.
- **Backend:** Supabase (plan gratuito) usando `@supabase/supabase-js` desde CDN (`cdn.jsdelivr.net/npm/@supabase/supabase-js@2`), sin servidor propio.
  - **Storage:** bucket público `fotos`.
  - **Base de datos:** tabla `registros`.
- **Hosting:** el mismo repositorio de GitHub ya conectado a Vercel (sitio estático, sin build).
- La URL y la clave pública (anon key) de Supabase van en `app/config.js` como constantes, claramente marcadas para completar. No uses claves secretas (service role) en el frontend.

## 5. Datos

### Partidas (lista fija, con avance planificado de ejemplo para hoy)
| Partida | Planificado hoy |
|---|---|
| Tabiquería | 72% |
| Cielos | 40% |
| Pintura | 20% |
| Instalaciones | 80% |

### Tabla `registros` (SQL para el SQL Editor de Supabase)
```sql
create table registros (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  partida text not null,
  ubicacion text,
  lat double precision,
  lng double precision,
  avance_estimado int,
  avance_validado int not null,
  foto_url text not null
);

alter table registros enable row level security;
create policy "demo leer" on registros for select using (true);
create policy "demo insertar" on registros for insert with check (true);
```

### Storage
Crear el bucket `fotos` como **público** y agregar esta política:
```sql
create policy "demo subir fotos" on storage.objects
  for insert to anon with check (bucket_id = 'fotos');
```
> Estas políticas abiertas son solo para la demo. Indícalo en el README.

## 6. Estimación simulada (importante, ser honestos)
No hay modelo de visión artificial. La app debe:
- Generar un valor de ejemplo cercano al planificado de esa partida (por ejemplo, planificado ± un número aleatorio entre 0 y 12), sin pasar de 0–100.
- Mostrar siempre el texto: **"Estimación de ejemplo (simulada). El avance real lo define el profesional."**
- Dejar el código preparado: una sola función `estimarAvance(foto, partida)` en `app.js`, para reemplazarla más adelante por un modelo real.

## 7. Pantallas y flujo (una sola página, mobile-first)
1. **Inicio:** título, botón grande "Nuevo registro", acceso a "Historial" y "Curva de avance".
2. **Nuevo registro** (por pasos en la misma página):
   1. Elegir partida (lista).
   2. Tomar o subir foto: `<input type="file" accept="image/*" capture="environment">`. Mostrar vista previa.
   3. Datos automáticos: fecha y hora actuales y ubicación por `navigator.geolocation`. Si el usuario no da permiso, mostrar "Ubicación no disponible" y permitir escribir una ubicación a mano (ej. "Piso 3 · Sector B").
   4. Estimación: mostrar el % simulado vs el planificado y la diferencia en puntos.
   5. Validar: slider 0–100 precargado con la estimación, y botón **Confirmar**. Al confirmar: subir la foto al bucket `fotos`, guardar la fila en `registros` y mostrar "Registro guardado".
3. **Historial:** lista de registros, del más reciente al más antiguo, con miniatura de la foto, partida, fecha/hora, ubicación y avance validado. Filtro por partida.
4. **Curva de avance:** gráfico simple en SVG puro o `<canvas>` (sin librerías pesadas) con dos líneas: planificado y real (promedio de los avances validados por día). Con pocos datos debe verse bien igual.

## 8. Requisitos funcionales
- RF1. Subir una foto y guardarla en Supabase Storage con un nombre único.
- RF2. Guardar fecha/hora, ubicación (o texto manual), partida, avance estimado y avance validado.
- RF3. No permitir confirmar sin partida y sin foto.
- RF4. Mostrar el historial leyendo desde Supabase, con las fotos visibles.
- RF5. Mostrar la curva con los datos guardados.
- RF6. Comprimir/redimensionar la foto en el navegador antes de subirla (ancho máximo 1280 px, JPEG ~0.8) para ahorrar espacio del plan gratuito.
- RF7. Mensajes claros de carga y de error (sin conexión, falla de subida).

## 9. Requisitos no funcionales
- Funciona bien en celular (Chrome y Safari) y en computador.
- Mismo estilo visual que la landing: fondo oscuro, acento rojo `#E20613`, tipografía del sistema.
- Textos en español.
- Sin dependencias que exijan build. Todo debe abrirse y desplegarse tal cual.
- Respetar `prefers-reduced-motion`.
- Código simple y comentado, para que estudiantes puedan entenderlo y modificarlo.

## 10. Criterios de aceptación
- [ ] Desde el celular puedo tomar una foto, elegir la partida y confirmar el avance.
- [ ] Al recargar la página, el registro y su foto siguen apareciendo en el historial.
- [ ] Otra persona que abre el link ve los mismos registros.
- [ ] La curva muestra la línea de plan y la línea real.
- [ ] La estimación dice claramente que es simulada.
- [ ] La landing original sigue funcionando en la raíz.

## 11. Entregables y pasos que Claude Code debe dejar documentados
1. Carpeta `app/` con `index.html`, `styles.css`, `app.js` y `config.js`.
2. `app/README.md` con el paso a paso, en español y para principiantes:
   - Crear cuenta y proyecto gratis en supabase.com.
   - Ejecutar el SQL de la sección 5 en el SQL Editor.
   - Crear el bucket público `fotos`.
   - Copiar la URL del proyecto y la clave `anon public` (Settings > API) en `app/config.js`.
   - Subir los cambios a GitHub; Vercel publica solo en `/app/`.
3. En la landing (`index.html`), agregar un botón o enlace "Probar el prototipo" que lleve a `/app/`, sin alterar el resto de la página.

## 12. Cómo trabajar
- Primero propón un plan breve y espera confirmación.
- Construye en este orden: estructura y estilos, flujo de foto con vista previa, conexión a Supabase, historial, curva, pulido.
- Prueba en un ancho de celular (390 px) y en computador.
- Al terminar, explica qué hacer para probarlo localmente y cómo desplegarlo.
