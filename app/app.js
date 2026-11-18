// ObraFoto · prototipo. JavaScript puro, sin build.
// Flujo: partida → foto → datos automáticos → estimación (simulada) → validar → guardar en Supabase.

// ---------- Datos fijos ----------
// Avance planificado de ejemplo para HOY, por partida.
const PARTIDAS = { "Tabiquería": 72, "Cielos": 40, "Pintura": 20, "Instalaciones": 80 };
const DIAS_PLAN = 30; // la curva "plan" de ejemplo sube desde 0 % hace 30 días hasta el planificado de hoy

const $ = (id) => document.getElementById(id);

// ---------- Supabase ----------
const configurado = SUPABASE_URL && SUPABASE_ANON_KEY;
const db = configurado && window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
if (!configurado) avisar("Falta configurar Supabase: completa app/config.js (ver app/README.md).");
else if (!db) avisar("No se pudo cargar Supabase. Revisa tu conexión a internet y recarga.");

function avisar(texto) { $("aviso").textContent = texto; $("aviso").hidden = false; }
window.addEventListener("offline", () => avisar("Sin conexión a internet. No se podrá guardar ni leer registros."));
window.addEventListener("online", () => { $("aviso").hidden = true; });

// ---------- Estimación SIMULADA ----------
// No hay visión artificial: devuelve el planificado ± un número aleatorio entre 0 y 12, dentro de 0–100.
// Para usar un modelo real más adelante, reemplaza SOLO esta función (puede volverse async).
function estimarAvance(foto, partida) {
  const plan = PARTIDAS[partida];
  const ruido = Math.round(Math.random() * 12) * (Math.random() < 0.5 ? -1 : 1);
  return Math.min(100, Math.max(0, plan + ruido));
}
// Auto-chequeo rápido (ver consola del navegador): la estimación siempre queda en 0–100.
for (let i = 0; i < 200; i++) for (const p in PARTIDAS) {
  const e = estimarAvance(null, p);
  console.assert(e >= 0 && e <= 100 && Math.abs(e - PARTIDAS[p]) <= 12, "estimarAvance fuera de rango", p, e);
}

// ---------- Navegación entre vistas ----------
function ir(destino) {
  $("v-inicio").hidden = destino !== "inicio";
  $("v-nuevo").hidden = destino !== "nuevo";
  $("v-datos").hidden = destino !== "historial" && destino !== "curva";
  if (destino === "nuevo") iniciarRegistro();
  if (destino === "historial" || destino === "curva") {
    $("historial").hidden = destino !== "historial";
    $("curva").hidden = destino !== "curva";
    $("tab-historial").setAttribute("aria-selected", destino === "historial");
    $("tab-curva").setAttribute("aria-selected", destino === "curva");
    cargarRegistros();
  }
  window.scrollTo(0, 0);
}
document.querySelectorAll("[data-ir]").forEach((el) =>
  el.addEventListener("click", (e) => { e.preventDefault(); ir(el.dataset.ir); })
);

// Llenar los <select> de partidas
for (const p in PARTIDAS) {
  $("partida").add(new Option(`${p} (plan hoy ${PARTIDAS[p]} %)`, p));
  $("filtro").add(new Option(p, p));
}

// ---------- Nuevo registro ----------
let foto = null;        // archivo elegido
let coords = null;      // { lat, lng } si el GPS respondió
let estimado = null;    // % simulado

function iniciarRegistro() {
  foto = null; coords = null; estimado = null;
  $("partida").value = ""; $("foto").value = ""; $("ubicacion").value = "";
  $("preview").hidden = true; $("paso-estimacion").hidden = true; $("paso-validar").hidden = true;
  mostrarEstado("", "");
  $("fecha").textContent = new Date().toLocaleString("es-CL");
  actualizar();

  if (!navigator.geolocation) return sinGps();
  $("gps").textContent = "Buscando ubicación…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      $("gps").textContent = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
    },
    sinGps,
    { enableHighAccuracy: true, timeout: 10000 }
  );
}
function sinGps() { $("gps").textContent = "Ubicación no disponible (escríbela abajo)"; }

$("partida").addEventListener("change", actualizar);
$("foto").addEventListener("change", () => {
  foto = $("foto").files[0] || null;
  if (foto) { $("preview").src = URL.createObjectURL(foto); $("preview").hidden = false; }
  else $("preview").hidden = true;
  actualizar();
});
$("slider").addEventListener("input", () => { $("valor").textContent = $("slider").value + "%"; });

// Recalcula la estimación cuando hay partida y foto. Sin ambas no se puede confirmar (RF3).
function actualizar() {
  const partida = $("partida").value;
  const listo = Boolean(partida && foto);
  $("confirmar").disabled = !listo;
  $("paso-estimacion").hidden = !listo;
  $("paso-validar").hidden = !listo;
  if (!listo) return;

  estimado = estimarAvance(foto, partida);
  const plan = PARTIDAS[partida];
  const dif = estimado - plan;
  $("est").textContent = estimado + "%";
  $("plan").textContent = plan + "%";
  $("dif").textContent = (dif > 0 ? "+" : "") + dif + " pts";
  $("slider").value = estimado;
  $("valor").textContent = estimado + "%";
}

// Reduce la foto a máx. 1280 px de ancho y la convierte a JPEG 0.8 (RF6).
function comprimir(archivo) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, 1280 / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la foto"))), "image/jpeg", 0.8);
    };
    img.onerror = () => reject(new Error("El archivo no es una imagen válida"));
    img.src = URL.createObjectURL(archivo);
  });
}

$("confirmar").addEventListener("click", async () => {
  const partida = $("partida").value;
  if (!partida || !foto) return mostrarEstado("Elige una partida y una foto.", "error");
  if (!db) return mostrarEstado("Supabase no está configurado (app/config.js).", "error");
  if (!navigator.onLine) return mostrarEstado("Sin conexión. Intenta de nuevo cuando tengas internet.", "error");

  $("confirmar").disabled = true;
  try {
    mostrarEstado("Comprimiendo foto…", "");
    const blob = await comprimir(foto);

    mostrarEstado("Subiendo foto…", "");
    const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`; // nombre único (RF1)
    const subida = await db.storage.from("fotos").upload(nombre, blob, { contentType: "image/jpeg" });
    if (subida.error) throw new Error("Falló la subida de la foto: " + subida.error.message);
    const fotoUrl = db.storage.from("fotos").getPublicUrl(nombre).data.publicUrl;

    mostrarEstado("Guardando registro…", "");
    const manual = $("ubicacion").value.trim();
    const { error } = await db.from("registros").insert({
      partida,
      ubicacion: manual || (coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "Ubicación no disponible"),
      lat: coords ? coords.lat : null,
      lng: coords ? coords.lng : null,
      avance_estimado: estimado,
      avance_validado: Number($("slider").value),
      foto_url: fotoUrl,
    });
    if (error) throw new Error("No se pudo guardar el registro: " + error.message);

    mostrarEstado("✓ Registro guardado", "ok");
    setTimeout(() => ir("historial"), 1200);
  } catch (err) {
    mostrarEstado(err.message || "Error inesperado", "error");
    $("confirmar").disabled = false;
  }
});

function mostrarEstado(texto, tipo, id = "estado") {
  $(id).textContent = texto;
  $(id).className = "estado " + tipo;
}

// ---------- Historial y curva ----------
let registros = [];

async function cargarRegistros() {
  if (!db) return mostrarEstado("Supabase no está configurado (app/config.js).", "error", "estado-datos");
  mostrarEstado("Cargando…", "", "estado-datos");
  const { data, error } = await db.from("registros").select("*").order("created_at", { ascending: false });
  if (error) return mostrarEstado("No se pudieron leer los registros: " + error.message, "error", "estado-datos");
  registros = data;
  mostrarEstado("", "", "estado-datos");
  pintar();
}
$("filtro").addEventListener("change", pintar);

function pintar() {
  const filtro = $("filtro").value;
  const lista = filtro ? registros.filter((r) => r.partida === filtro) : registros;
  pintarHistorial(lista);
  pintarCurva(lista, filtro);
}

// Escapa texto escrito por usuarios antes de meterlo en HTML (evita inyección de código).
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function pintarHistorial(lista) {
  $("lista").innerHTML = lista.length
    ? lista.map((r) => `
      <li>
        <a href="${esc(r.foto_url)}" target="_blank" rel="noopener"><img src="${esc(r.foto_url)}" alt="Foto de ${esc(r.partida)}" loading="lazy"></a>
        <div>
          <strong>${esc(r.partida)}</strong>
          <p>${new Date(r.created_at).toLocaleString("es-CL")}</p>
          <p>${esc(r.ubicacion)}</p>
        </div>
        <span class="pct">${r.avance_validado}%</span>
      </li>`).join("")
    : `<li class="mute">Aún no hay registros.</li>`;
}

// Fecha local en formato AAAA-MM-DD (para agrupar por día)
const dia = (fecha) => new Date(fecha).toLocaleDateString("sv-SE");
const DIA_MS = 86400000;

function pintarCurva(lista, filtro) {
  // Plan de hoy: el de la partida filtrada, o el promedio de todas.
  const valores = Object.values(PARTIDAS);
  const planHoy = filtro ? PARTIDAS[filtro] : valores.reduce((a, b) => a + b, 0) / valores.length;

  // Real: promedio de avances validados por día.
  const porDia = {};
  for (const r of lista) (porDia[dia(r.created_at)] ||= []).push(r.avance_validado);
  const reales = Object.keys(porDia).sort().map((d) => ({
    t: new Date(d + "T12:00").getTime(),
    v: porDia[d].reduce((a, b) => a + b, 0) / porDia[d].length,
  }));

  // Eje X: desde hace 30 días (o el registro más antiguo) hasta hoy.
  const hoy = new Date(dia(Date.now()) + "T12:00").getTime();
  const inicioPlan = hoy - DIAS_PLAN * DIA_MS;
  const desde = Math.min(inicioPlan, ...reales.map((p) => p.t));

  const W = 360, H = 220, L = 34, R = 12, T = 12, B = 28;
  const x = (t) => L + ((t - desde) / (hoy - desde)) * (W - L - R);
  const y = (v) => T + (1 - v / 100) * (H - T - B);

  let svg = "";
  for (const v of [0, 25, 50, 75, 100]) {
    svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.08)"/>`;
    svg += `<text x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${v}%</text>`;
  }
  const corto = (t) => new Date(t).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
  svg += `<text x="${L}" y="${H - 8}">${corto(desde)}</text><text x="${W - R}" y="${H - 8}" text-anchor="end">Hoy</text>`;

  // Línea plan (rampa de ejemplo)
  svg += `<polyline fill="none" stroke="#86868b" stroke-width="2" stroke-dasharray="5 4"
    points="${x(desde)},${y(0)} ${x(inicioPlan)},${y(0)} ${x(hoy)},${y(planHoy)}"/>`;

  // Línea real: igual que el plan, parte en 0 % al inicio de la obra; los puntos son los días con registros
  if (reales.length) {
    const linea = reales[0].t > inicioPlan ? [{ t: inicioPlan, v: 0 }, ...reales] : reales;
    svg += `<polyline fill="none" stroke="#E20613" stroke-width="2.5" points="${linea.map((p) => `${x(p.t)},${y(p.v)}`).join(" ")}"/>`;
    svg += reales.map((p) => `<circle cx="${x(p.t)}" cy="${y(p.v)}" r="4" fill="#E20613"><title>${corto(p.t)}: ${Math.round(p.v)}%</title></circle>`).join("");
  } else {
    svg += `<text x="${W / 2}" y="${H / 2}" text-anchor="middle">Sin registros reales todavía</text>`;
  }
  $("grafico").innerHTML = svg;
}

ir("inicio");
