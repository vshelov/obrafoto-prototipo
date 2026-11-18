# ObraFoto · Prototipo funcional

Registro de avance de obra con fotos: elegir partida → tomar foto → estimación **simulada** → validar → historial y curva.
HTML + CSS + JavaScript puro. Sin build. Datos y fotos en Supabase (plan gratuito).

> **La estimación de avance es simulada** (planificado ± 0–12 %). No hay visión artificial.
> Para conectar un modelo real, reemplaza la función `estimarAvance(foto, partida)` en `app.js`.

## 1. Crear el proyecto en Supabase (gratis)
1. Entra a https://supabase.com y pulsa **Start your project**. Inicia sesión con tu cuenta de GitHub.
2. **New project**: ponle un nombre (ej. `obrafoto`), crea una contraseña de base de datos (guárdala), elige la región **South America (São Paulo)** y el plan **Free**. Pulsa **Create new project** y espera 1–2 minutos.

## 2. Crear la tabla
1. Menú izquierdo: **SQL Editor** → **New query**.
2. Pega esto y pulsa **Run**:

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

## 3. Crear el bucket de fotos
1. Menú izquierdo: **Storage** → **New bucket**.
2. Nombre: `fotos` (exacto, en minúsculas). Activa **Public bucket**. Pulsa **Create**.
3. Vuelve a **SQL Editor** → **New query**, pega esto y pulsa **Run**:

```sql
create policy "demo subir fotos" on storage.objects
  for insert to anon with check (bucket_id = 'fotos');
```

> ⚠️ **Estas políticas son abiertas y solo sirven para la demo**: cualquiera que tenga el link puede ver y agregar registros y fotos.
> No uses esta configuración con datos reales: para eso haría falta un login.

## 4. Conectar la app
1. En Supabase: **Project Settings** (engranaje) → **API** (o **Data API** / **API Keys**).
2. Copia la **Project URL** y la clave **anon public**.
3. Abre `app/config.js` y pégalas entre las comillas:
   ```js
   const SUPABASE_URL = "https://xxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOi...";
   ```
   La clave `anon` es pública y puede ir en el frontend. **Nunca** pegues la clave `service_role`.

## 5. Probar en tu computador
La cámara y el GPS solo funcionan en `https://` o en `localhost` (no con doble clic en el archivo).
Desde la carpeta raíz del repositorio:
```
npx serve .
```
y abre `http://localhost:3000/app/`.

## 6. Publicar
Sube los cambios a GitHub. Vercel publica solo y el prototipo queda en `https://TU-PROYECTO.vercel.app/app/`.
```
git add .
git commit -m "Prototipo funcional en /app"
git push
```
