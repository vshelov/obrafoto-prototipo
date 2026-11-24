// ObraFoto · prototipo. JavaScript puro, sin build.
// Flujo: partida → foto → datos automáticos → estimación (simulada) → validar → guardar en Supabase.

// ---------- Datos fijos ----------
// Por partida: peso en la obra (%) y avance planificado para HOY (%). Valores de ejemplo:
// en una obra real los pesos salen del presupuesto o de las horas de cada partida.
const OBRA = "Obra de ejemplo";
const PARTIDAS = {
  "Tabiquería":    { peso: 30, plan: 72 },
  "Cielos":        { peso: 20, plan: 40 },
  "Pintura":       { peso: 20, plan: 20 },
  "Instalaciones": { peso: 30, plan: 80 },
};
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
  const plan = PARTIDAS[partida].plan;
  const ruido = Math.round(Math.random() * 12) * (Math.random() < 0.5 ? -1 : 1);
  return Math.min(100, Math.max(0, plan + ruido));
}
// Auto-chequeo rápido (ver consola del navegador): la estimación siempre queda en 0–100.
for (let i = 0; i < 200; i++) for (const p in PARTIDAS) {
  const e = estimarAvance(null, p);
  console.assert(e >= 0 && e <= 100 && Math.abs(e - PARTIDAS[p].plan) <= 12, "estimarAvance fuera de rango", p, e);
}

// ---------- Avance de la obra ----------
// Real de una partida = su último avance validado (0 si no tiene registros).
// Real de la obra = Σ(peso × real) / Σ pesos. Plan de la obra = Σ(peso × plan) / Σ pesos. Desviación = real − plan.
// `regs` debe venir del más nuevo al más antiguo (así los entrega cargarRegistros).
const r1 = (v) => Math.round(v * 10) / 10;
function calcularAvance(regs) {
  let pesos = 0, real = 0, plan = 0;
  const filas = Object.entries(PARTIDAS).map(([nombre, p]) => {
    const ultimo = regs.find((r) => r.partida === nombre);
    const realP = ultimo ? Number(ultimo.avance_validado) : 0;
    pesos += p.peso; real += p.peso * realP; plan += p.peso * p.plan;
    return { nombre, peso: p.peso, plan: p.plan, real: realP, dif: realP - p.plan };
  });
  return { filas, real: r1(real / pesos), plan: r1(plan / pesos), desv: r1((real - plan) / pesos) };
}
// Auto-chequeo con el ejemplo del documento: reales 68, 35, 12, 81 → 54,1 % real; 57,6 % plan; −3,5 pts.
{
  const a = calcularAvance([68, 35, 12, 81].map((v, i) => ({ partida: Object.keys(PARTIDAS)[i], avance_validado: v })));
  console.assert(a.real === 54.1 && a.plan === 57.6 && a.desv === -3.5, "calcularAvance no cuadra con el ejemplo", a);
}

const num = (v) => v.toLocaleString("es-CL", { maximumFractionDigits: 1 });
const pct = (v) => num(v) + " %";
const pts = (v) => (v > 0 ? "+" : "") + num(v) + " pts";

// ---------- Navegación entre vistas ----------
// Cada vista queda en la URL (#nuevo, #historial, #curva) para que el botón atrás del navegador
// vuelva a la vista anterior en vez de salir a la landing.
const VISTAS = ["inicio", "nuevo", "historial", "curva"];
function ir(destino) {
  if (location.hash === "#" + destino) mostrar(destino);
  else location.hash = destino; // dispara hashchange → mostrar
}
// Cada entrada del historial guarda su profundidad dentro de la app (n), para que "Volver" sepa si hay a dónde volver.
let nivel = history.state?.n ?? 0;
if (history.state == null) history.replaceState({ n: 0 }, "");
window.addEventListener("hashchange", () => {
  if (history.state == null) history.replaceState({ n: nivel + 1 }, ""); // entrada nueva creada por ir()
  nivel = history.state.n;
  mostrar(location.hash.slice(1));
});
// Botón "← Volver": regresa a la vista anterior; si se entró directo a esta vista, va al inicio.
document.querySelectorAll(".atras").forEach((b) =>
  b.addEventListener("click", () => (nivel > 0 ? history.back() : ir("inicio")))
);
function mostrar(destino) {
  if (!VISTAS.includes(destino)) destino = "inicio";
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
  $("partida").add(new Option(`${p} (plan hoy ${PARTIDAS[p].plan} %)`, p));
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
  const plan = PARTIDAS[partida].plan;
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
  $("grafico").innerHTML = svgCurva(lista, filtro);
  pintarAvance();
}

// Bloque "Avance de la obra": siempre con todos los registros (no depende del filtro).
function pintarAvance() {
  const a = calcularAvance(registros);
  $("obra-real").textContent = pct(a.real);
  $("obra-plan").textContent = pct(a.plan);
  $("obra-desv").textContent = pts(a.desv);
  $("tabla-partidas").innerHTML = tablaPartidas(a);
}

const tablaPartidas = (a) => `
  <thead><tr><th>Partida</th><th>Peso</th><th>Plan</th><th>Real</th><th>Dif.</th></tr></thead>
  <tbody>${a.filas.map((f) => `<tr><td>${esc(f.nombre)}</td><td>${f.peso}%</td><td>${f.plan}%</td><td>${f.real}%</td><td>${pts(f.dif)}</td></tr>`).join("")}</tbody>`;

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

// Devuelve el contenido SVG de la curva (se usa en la app y en el informe PDF).
function svgCurva(lista, filtro) {
  // Plan de hoy: el de la partida filtrada, o el planificado ponderado de la obra.
  const planHoy = filtro ? PARTIDAS[filtro].plan : calcularAvance([]).plan;

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
  return svg;
}

// ---------- Descargas (todo en el navegador) ----------
const sinRegistros = () => {
  if (registros.length) return false;
  mostrarEstado("Aún no hay registros para descargar.", "error", "estado-datos");
  return true;
};

// Excel con xlsx-js-style (SheetJS con estilos): hojas Resumen, Por partida y Registros.
const XC = { rojo: "E20613", oscuro: "1D1D1F", gris: "6E6E73", zebra: "F5F5F7", borde: "D2D2D7", verde: "1E8E3E", azul: "0066CC" };
const XF = { pct: '0.0" %"', pts: '+0.0" pts";-0.0" pts";0.0" pts"', fecha: "dd-mm-yyyy hh:mm" };
const linea = { style: "thin", color: { rgb: XC.borde } };
const bordes = { top: linea, bottom: linea, left: linea, right: linea };
const FILA0 = 4; // filas: título, subtítulo, espacio, encabezado; los datos parten en la 5.ª
// Fecha como número de Excel en hora local, para que se pueda ordenar y filtrar.
const fechaExcel = (f) => { const t = new Date(f).getTime(); return (t - new Date(t).getTimezoneOffset() * 60000) / DIA_MS + 25569; };

// Hoja con banda de título, encabezado oscuro, filas cebra con bordes; formato(fila, col) da el formato numérico.
function hojaExcel(titulo, encabezado, filas, anchos, formato = () => undefined) {
  const n = encabezado.length;
  const ws = XLSX.utils.aoa_to_sheet([[titulo], [`${OBRA} · generado el ${new Date().toLocaleString("es-CL")}`], [], encabezado, ...filas]);
  ws["!merges"] = [0, 1].map((r) => ({ s: { r, c: 0 }, e: { r, c: n - 1 } }));
  ws["!cols"] = anchos.map((wch) => ({ wch }));
  ws["!rows"] = [{ hpt: 30 }, { hpt: 18 }, { hpt: 8 }, { hpt: 24 }];
  ws.A1.s = { font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: XC.rojo } }, alignment: { vertical: "center", indent: 1 } };
  ws.A2.s = { font: { italic: true, color: { rgb: XC.gris } }, alignment: { indent: 1 } };
  encabezado.forEach((_, c) => {
    ws[XLSX.utils.encode_cell({ r: 3, c })].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: XC.oscuro } },
      alignment: { horizontal: c ? "center" : "left", vertical: "center", wrapText: true }, border: bordes };
  });
  filas.forEach((fila, i) => fila.forEach((v, c) => {
    const celda = ws[XLSX.utils.encode_cell({ r: FILA0 + i, c })];
    if (!celda) return;
    const z = formato(i, c);
    if (z) celda.z = z;
    // Diferencias negativas en rojo y positivas en verde
    const color = z === XF.pts && v ? (v < 0 ? XC.rojo : XC.verde) : XC.oscuro;
    celda.s = { font: { color: { rgb: color }, bold: z === XF.pts }, border: bordes,
      fill: i % 2 ? { fgColor: { rgb: XC.zebra } } : undefined,
      alignment: { horizontal: typeof v === "number" ? "center" : "left", vertical: "center" } };
  }));
  return ws;
}
const conFiltro = (ws, nFilas, nCols) => { ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3 + nFilas, c: nCols - 1 } }) }; };

$("btn-excel").addEventListener("click", () => {
  if (sinRegistros()) return;
  if (!window.XLSX) return mostrarEstado("No se pudo cargar la librería de Excel. Revisa tu conexión y recarga.", "error", "estado-datos");
  const a = calcularAvance(registros);
  const libro = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(libro, hojaExcel("Resumen del avance", ["Indicador", "Valor"], [
    ["Avance real", a.real],
    ["Avance planificado", a.plan],
    ["Desviación", a.desv],
    ["Registros en el período", registros.length],
  ], [32, 18], (i) => [XF.pct, XF.pct, XF.pts][i]), "Resumen");

  const partidas = [...a.filas.map((f) => [f.nombre, f.peso, f.plan, f.real, f.dif]), ["Total obra (ponderado)", 100, a.plan, a.real, a.desv]];
  const wsP = hojaExcel("Avance por partida", ["Partida", "Peso", "Planificado", "Real (último validado)", "Diferencia"],
    partidas, [26, 10, 14, 22, 14], (_, c) => [undefined, XF.pct, XF.pct, XF.pct, XF.pts][c]);
  // Fila de total destacada
  for (let c = 0; c < 5; c++) {
    const s = wsP[XLSX.utils.encode_cell({ r: FILA0 + partidas.length - 1, c })].s;
    s.font.bold = true; s.fill = { fgColor: { rgb: "FDE7E8" } }; s.border = { ...bordes, top: { style: "medium", color: { rgb: XC.rojo } } };
  }
  XLSX.utils.book_append_sheet(libro, wsP, "Por partida");

  const wsR = hojaExcel("Registros de avance", ["Fecha y hora", "Partida", "Ubicación", "Avance estimado", "Avance validado", "Foto"],
    registros.map((r) => [fechaExcel(r.created_at), r.partida, r.ubicacion ?? "", r.avance_estimado, r.avance_validado, r.foto_url || ""]),
    [18, 16, 26, 16, 16, 12], (_, c) => [XF.fecha, undefined, undefined, XF.pct, XF.pct][c]);
  // La columna Foto muestra "Ver foto" como enlace clicable
  registros.forEach((r, i) => {
    const celda = wsR[XLSX.utils.encode_cell({ r: FILA0 + i, c: 5 })];
    if (!celda || !r.foto_url) return;
    celda.v = "Ver foto"; celda.l = { Target: r.foto_url };
    celda.s.font = { color: { rgb: XC.azul }, underline: true }; celda.s.alignment.horizontal = "center";
  });
  conFiltro(wsR, registros.length, 6);
  XLSX.utils.book_append_sheet(libro, wsR, "Registros");

  XLSX.writeFile(libro, `avance_obra_${dia(Date.now())}.xlsx`);
});

// PDF: arma un informe claro y abre la ventana de impresión ("Guardar como PDF" o compartir en celular).
$("btn-pdf").addEventListener("click", async () => {
  if (sinRegistros()) return;
  const a = calcularAvance(registros);
  $("informe").innerHTML = `
    <h1>Informe de avance de obra</h1>
    <p>${esc(OBRA)} · ${new Date().toLocaleString("es-CL")}</p>
    <div class="nums">
      <div><small>Avance real</small><strong>${pct(a.real)}</strong></div>
      <div><small>Planificado</small><strong>${pct(a.plan)}</strong></div>
      <div><small>Desviación</small><strong>${pts(a.desv)}</strong></div>
    </div>
    <h2>Por partida</h2>
    <table class="tabla">${tablaPartidas(a)}</table>
    <h2>Curva de avance (plan vs real)</h2>
    <svg class="curva" viewBox="0 0 360 220">${svgCurva(registros, "")}</svg>
    <h2>Fotos recientes</h2>
    <div class="fotos">${registros.slice(0, 6).map((r) => `
      <figure><img src="${esc(r.foto_url)}" alt="Foto de ${esc(r.partida)}">
      <figcaption>${esc(r.partida)} · ${new Date(r.created_at).toLocaleDateString("es-CL")}</figcaption></figure>`).join("")}</div>
    <p class="nota">La estimación inicial es simulada; el avance informado fue validado por el profesional.</p>`;

  // Espera las fotos (máx. 5 s). Si una no carga, se quita y el informe sale igual.
  mostrarEstado("Preparando informe…", "", "estado-datos");
  await Promise.all([...$("informe").querySelectorAll("img")].map((img) => new Promise((listo) => {
    img.onload = listo;
    img.onerror = () => { img.closest("figure").remove(); listo(); };
    setTimeout(listo, 5000);
  })));
  mostrarEstado("", "", "estado-datos");

  const titulo = document.title;
  document.title = `informe_avance_${dia(Date.now())}`; // el navegador lo propone como nombre del PDF
  window.addEventListener("afterprint", () => { document.title = titulo; }, { once: true });
  window.print();
});

mostrar(location.hash.slice(1)); // al recargar se queda en la vista donde estaba
