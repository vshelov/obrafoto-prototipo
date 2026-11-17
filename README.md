# ObraFoto · Prototipo de muestra

Landing page estática (HTML + CSS + JS, sin dependencias ni build) que muestra, mientras se hace scroll,
cómo funcionaría el sistema de control de avance físico con fotos. Es una maqueta: los datos son de ejemplo.

## Probar en tu computador
Abre `index.html` con doble clic (o `npx serve .`).

## Subir a GitHub
1. Crea un repositorio nuevo en GitHub (por ejemplo `obrafoto-prototipo`).
2. Sube todos los archivos de esta carpeta a la raíz del repositorio (botón **Add file > Upload files**).

## Publicar gratis en Vercel
1. Entra a vercel.com e inicia sesión con tu cuenta de GitHub.
2. **Add New > Project**, elige el repositorio.
3. Framework Preset: **Other**. No necesitas Build Command ni Output Directory.
4. **Deploy**. Vercel te da un link tipo `https://obrafoto-prototipo.vercel.app` para compartir.

Cada vez que subas un cambio a GitHub, Vercel se actualiza solo.

## Personalizar
- Nombre "ObraFoto" es un nombre de trabajo: búscalo y reemplázalo en `index.html`.
- Textos, colores (variables `:root` en `styles.css`) y pasos están en `index.html` y `styles.css`.
