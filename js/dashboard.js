// ===================== CONSTANTES =====================
var SUCURSALES = ["NAZCA", "OLAZABAL", "CUENCA", "BEIRO", "GOYENA"];

var COLORS = {
  NAZCA:    "#f0a500",
  OLAZABAL: "#4da6ff",
  CUENCA:   "#00e676",
  BEIRO:    "#ff6b6b",
  GOYENA:   "#c084fc"
};

var RUBROS_ING = [
  { id: "efectivo",      label: "Efectivo" },
  { id: "debito",        label: "Débito" },
  { id: "credito",       label: "Crédito" },
  { id: "prepaga",       label: "Prepaga" },
  { id: "mercadopago",   label: "QR" },
  { id: "transferencia", label: "Transferencia" },
  { id: "linkpago",      label: "Link de Pago" }
];

var RUBROS_EG = [
  { id: "proveedores",        label: "Proveedores" },
  { id: "insumos",            label: "Insumos" },
  { id: "alquiler",           label: "Alquiler" },
  { id: "servicios",          label: "Servicios" },
  { id: "retiro",             label: "Retiro" },
  { id: "transferencia-inter",label: "Transf. inter-sucursal" },
  { id: "otros",              label: "Otros" }
];

var MOTIVOS_MERMA = {
  vencimiento: "Vencimiento",
  deterioro:   "Deterioro",
  rotura:      "Rotura",
  robo:        "Robo / faltante",
  otros:       "Otros"
};

var CATS_DEUDA = {
  banco:           "Banco",
  cuenta_corriente:"Cuenta Corriente",
  cheques:         "Cheques",
  tarjetas:        "Tarjetas",
  proveedores:     "Proveedores",
  sueldos:         "Sueldos",
  cargas_sociales: "Cargas Sociales",
  servicios:       "Servicios",
  alquileres:      "Alquileres",
  impuestos:       "Impuestos"
};

// Objetivos default (se sobreescriben con localStorage)
var OBJETIVOS_DEFAULT = {
  NAZCA: 36000000, OLAZABAL: 29000000, CUENCA: 30000000,
  BEIRO: 23000000, GOYENA:   26000000
};

function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function(c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

// ===================== ESTADO =====================
var allData           = {};
var allFacturas       = [];
var allDeudas         = [];
var allEmpleados      = [];
var sueldosRef        = null;
var empleadosAnalyticsRef = null;
var allProveedores    = [];
var provRef           = null;
var charts            = {};
var sectionActual     = "home";
var periodEgresos     = "7";
var periodMerma       = "mes";
var periodHist        = "semana";
var viewParticipacion = "donut"; // "donut" | "bar"
var facturasMesViendo  = null;    // se inicializa en initFacturas()
var objetivosMesViendo = null;    // se inicializa en initObjetivosModal()
var objetivosView      = "cards";
var periodHome         = "hoy";
var periodHomeDesde    = "";
var periodHomeHasta    = "";
var todosObjetivos     = {}; // { "YYYY-MM": { SUCURSAL: monto } }
var sueldosSortCol     = "nombre";
var sueldosSortDir     = "asc";
var sueldosInitedOnce  = false;
var historialMesViendo = null;

// ===================== AUTH DASHBOARD =====================
var AUTH_KEY      = "vvglobal_dash_auth";
var AUTH_DURATION = 8 * 60 * 60 * 1000; // 8 horas

function readStorage(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw === null ? fallback : raw;
  } catch (e) {
    console.warn("Storage no disponible:", e);
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn("No se pudo guardar en storage:", e);
    return false;
  }
}

function firebaseReadyForUi() {
  return !!(window.firebase && typeof window.firebase.database === "function");
}

function ensureFirebaseReady(contextLabel) {
  if (!firebaseReadyForUi()) {
    var label = contextLabel || "la app";
    console.error("[VV Global] Firebase no inicializado para " + label + ". Revisá config.js.");
    var errorEl = document.getElementById("db-config-error");
    if (errorEl) {
      errorEl.textContent = "No se pudo inicializar Firebase. Revisá la configuración del proyecto.";
      errorEl.classList.remove("hidden");
    }
    return false;
  }
  return true;
}

function dashAuthValida() {
  try {
    var raw = readStorage(AUTH_KEY, null);
    if (!raw) return false;
    var data = JSON.parse(raw);
    return (Date.now() - data.ts) < AUTH_DURATION;
  } catch(e) { return false; }
}

function guardarDashAuth() {
  writeStorage(AUTH_KEY, JSON.stringify({ ts: Date.now() }));
}

function initDashLogin() {
  if (!ensureFirebaseReady("dashboard")) return false;

  var pantalla = document.getElementById("pantalla-login");
  var input    = document.getElementById("db-login-input");
  var btn      = document.getElementById("db-login-btn");
  var errEl    = document.getElementById("db-login-error");

  if (dashAuthValida()) {
    pantalla.classList.add("hidden");
    return true;
  }

  pantalla.classList.remove("hidden");

  function intentarLogin() {
    var clave = input.value.trim();
    if (!clave) return;
    btn.disabled    = true;
    btn.textContent = "Verificando...";
    errEl.classList.add("hidden");

    firebase.database().ref("config/claves/dashboard").once("value")
      .then(function(snap) {
        var ok = !snap.exists() || clave === String(snap.val()).trim();
        if (ok) {
          guardarDashAuth();
          pantalla.classList.add("hidden");
          initApp();
        } else {
          errEl.classList.remove("hidden");
          input.value = "";
          input.focus();
        }
      })
      .catch(function() {
        errEl.textContent = "Error de conexión. Intentá de nuevo.";
        errEl.classList.remove("hidden");
      })
      .finally(function() {
        btn.disabled    = false;
        btn.textContent = "Ingresar";
      });
  }

  btn.addEventListener("click", intentarLogin);
  input.addEventListener("keyup", function(e) {
    if (e.key === "Enter") intentarLogin();
  });
  input.focus();
  return false;
}

// ===================== AUTH ADMIN =====================
var ADMIN_KEY      = "vvglobal_admin_auth";
var ADMIN_DURATION = 60 * 60 * 1000; // 1 hora

function adminAuthValida() {
  try {
    var raw = readStorage(ADMIN_KEY, null);
    if (!raw) return false;
    var data = JSON.parse(raw);
    return (Date.now() - data.ts) < ADMIN_DURATION;
  } catch(e) { return false; }
}

function guardarAdminAuth() {
  writeStorage(ADMIN_KEY, JSON.stringify({ ts: Date.now() }));
}

// Modal en página — devuelve Promise<boolean>
function pedirClaveAdmin() {
  if (adminAuthValida()) return Promise.resolve(true);

  return new Promise(function(resolve) {
    var overlay   = document.getElementById("admin-modal");
    var input     = document.getElementById("admin-modal-input");
    var btn       = document.getElementById("admin-modal-btn");
    var cancelBtn = document.getElementById("admin-modal-cancel");
    var errEl     = document.getElementById("admin-modal-error");

    input.value     = "";
    btn.disabled    = false;
    btn.textContent = "Confirmar";
    errEl.classList.add("hidden");
    overlay.classList.remove("hidden");
    setTimeout(function() { input.focus(); }, 80);

    function cerrar(resultado) {
      overlay.classList.add("hidden");
      btn.removeEventListener("click", intentar);
      cancelBtn.removeEventListener("click", cancelar);
      input.removeEventListener("keyup", onKey);
      resolve(resultado);
    }

    function intentar() {
      var clave = input.value.trim();
      if (!clave) return;
      btn.disabled    = true;
      btn.textContent = "Verificando...";
      errEl.classList.add("hidden");

      firebase.database().ref("config/claves/admin").once("value")
        .then(function(snap) {
          var ok = !snap.exists() || clave === String(snap.val()).trim();
          if (ok) {
            guardarAdminAuth();
            cerrar(true);
          } else {
            errEl.classList.remove("hidden");
            input.value     = "";
            btn.disabled    = false;
            btn.textContent = "Confirmar";
            input.focus();
          }
        })
        .catch(function() {
          errEl.textContent = "Error de conexión. Intentá de nuevo.";
          errEl.classList.remove("hidden");
          btn.disabled    = false;
          btn.textContent = "Confirmar";
        });
    }

    function cancelar() { cerrar(false); }
    function onKey(e)   { if (e.key === "Enter") intentar(); }

    btn.addEventListener("click", intentar);
    cancelBtn.addEventListener("click", cancelar);
    input.addEventListener("keyup", onKey);
  });
}

// ===================== HELPERS =====================
function today() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}
function mesActual() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
}
// Suma/resta meses de forma segura con fecha local (evita bugs de UTC en timezones negativos)
function sumarMes(mesStr, delta) {
  var anio = parseInt(mesStr.slice(0,4));
  var mes  = parseInt(mesStr.slice(5,7)) - 1 + delta;
  var d    = new Date(anio, mes, 1);
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
}

// Fecha operativa: antes de las 9:00 se considera que aún es el día anterior.
// Usa fecha LOCAL para evitar bugs de UTC en timezone Argentina (UTC-3).
function fechaOperativa() {
  var ahora = new Date();
  var h = ahora.getHours();
  var d = h < 9 ? new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1)
                : new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}

function mesOperativo() {
  return fechaOperativa().slice(0, 7);
}

function mesAnterior() {
  return sumarMes(mesActual(), -1);
}

function fmtM(n) {
  if (!n && n !== 0) return "—";
  if (Math.abs(n) >= 1000000) return "$" + (n / 1000000).toFixed(2) + "M";
  if (Math.abs(n) >= 1000)    return "$" + (n / 1000).toFixed(0) + "K";
  return "$" + Number(n).toLocaleString("es-AR");
}

function fmtFull(n) {
  if (!n && n !== 0) return "—";
  return "$" + Number(n).toLocaleString("es-AR");
}

// ===================== HELPERS FIREBASE =====================

// Ingresos de un registro (soporta formato nuevo y viejo)
function regIngresos(r) {
  if (r.tipo === "ventas")      return r.totalVentas   || 0;
  if (r.tipo === "movimientos") return r.totalIngInter  || 0;
  if (r.tipo === "merma")       return 0;
  return r.totalIngresos || 0; // formato viejo
}

// Egresos de un registro
function regEgresos(r) {
  if (r.tipo === "ventas")      return 0;
  if (r.tipo === "merma")       return 0;
  if (r.tipo === "movimientos") return r.totalEgresos || 0;
  return r.totalEgresos || 0; // formato viejo
}

function getRegs(fecha, suc) {
  return (allData[fecha] && allData[fecha][suc]) ? allData[fecha][suc] : [];
}

function sumField(fecha, suc, campo) {
  return getRegs(fecha, suc).reduce(function(a, r) {
    if (campo === "totalIngresos") return a + regIngresos(r);
    if (campo === "totalEgresos")  return a + regEgresos(r);
    return a + (r[campo] || 0);
  }, 0);
}

function sumRubro(fecha, suc, tipo, rubroId) {
  return getRegs(fecha, suc).reduce(function(a, r) {
    if (tipo === "ingresos") {
      if (r.tipo === "ventas"  && r.ventas   && r.ventas[rubroId])   return a + r.ventas[rubroId];
      if (!r.tipo              && r.ingresos && r.ingresos[rubroId]) return a + r.ingresos[rubroId];
      return a;
    }
    if (tipo === "egresos") {
      if (r.tipo === "movimientos" && r.egresos && r.egresos[rubroId]) return a + r.egresos[rubroId];
      if (!r.tipo                  && r.egresos && r.egresos[rubroId]) return a + r.egresos[rubroId];
      return a;
    }
    return a + ((r[tipo] && r[tipo][rubroId]) ? r[tipo][rubroId] : 0);
  }, 0);
}

function diasDeMes(mes) {
  return Object.keys(allData).filter(function(f) { return f.slice(0, 7) === mes; }).sort();
}

function ultimosDias(n) {
  var days = [];
  var base = new Date(fechaOperativa() + "T12:00:00");
  for (var i = n - 1; i >= 0; i--) {
    var d = new Date(base);
    d.setDate(d.getDate() - i);
    days.push(localDateStr(d));
  }
  return days;
}

function fechasDePeriodo(period, desde, hasta) {
  if (period === "hoy") return [fechaOperativa()];
  if (period === "7" || period === "semana") return ultimosDias(7);
  if (period === "15" || period === "30") return ultimosDias(parseInt(period, 10));
  if (period === "mes") return diasDeMes(mesOperativo()).filter(function(f) { return f <= fechaOperativa(); });
  if (period === "anterior") return diasDeMes(mesAnterior());
  if (period === "custom" && desde && hasta && desde <= hasta) {
    var fechas = [];
    var cursor = new Date(desde + "T12:00:00");
    var fin = new Date(hasta + "T12:00:00");
    while (cursor <= fin && fechas.length < 367) {
      fechas.push(localDateStr(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return fechas;
  }
  return [];
}

function initReportFilter(containerId, prefix, initialPeriod, render) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var activePeriod = initialPeriod;
  container.querySelectorAll("[data-period]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      container.querySelectorAll("[data-period]").forEach(function(item) { item.classList.remove("active"); });
      btn.classList.add("active");
      activePeriod = btn.getAttribute("data-period");
      var custom = activePeriod === "custom";
      document.getElementById(prefix + "-custom-range").classList.toggle("hidden", !custom);
      render(activePeriod);
    });
  });
  ["desde", "hasta"].forEach(function(suffix) {
    var input = document.getElementById(prefix + "-" + suffix);
    if (input) input.addEventListener("change", function() {
      activePeriod = "custom";
      container.querySelectorAll("[data-period]").forEach(function(item) { item.classList.toggle("active", item.getAttribute("data-period") === "custom"); });
      document.getElementById(prefix + "-custom-range").classList.remove("hidden");
      render(activePeriod);
    });
  });
  var sucursal = document.getElementById(prefix + "-sucursal");
  if (sucursal) sucursal.addEventListener("change", function() { render(activePeriod); });
}

function getMermaRegs(fecha, suc) {
  return getRegs(fecha, suc).filter(function(r) { return r.tipo === "merma"; });
}

// Local-timezone date string — avoids toISOString() UTC offset bugs in negative timezones
function localDateStr(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// ===================== NAVEGACIÓN =====================
function initNav() {
  var hamburger = document.getElementById("hamburger");
  var sidebar   = document.getElementById("sidebar");
  var overlay   = document.getElementById("nav-overlay");
  var closeBtn  = document.getElementById("sidebar-close");
  var mobileLayout = window.innerWidth <= 900;

  function setSidebarCollapsed(collapsed) {
    sidebar.classList.toggle("collapsed", collapsed);
    sidebar.classList.toggle("open", !collapsed);
    document.body.classList.toggle("sidebar-collapsed", collapsed);

    if (window.innerWidth <= 900) {
      overlay.classList.toggle("show", !collapsed);
    } else {
      overlay.classList.remove("show");
    }
  }

  hamburger.addEventListener("click", function() {
    setSidebarCollapsed(!sidebar.classList.contains("collapsed"));
  });

  window.addEventListener("resize", function() {
    var nextMobileLayout = window.innerWidth <= 900;
    if (nextMobileLayout && !mobileLayout) setSidebarCollapsed(true);
    mobileLayout = nextMobileLayout;
  });

  function closeSidebar() {
    setSidebarCollapsed(true);
  }

  overlay.addEventListener("click", closeSidebar);
  closeBtn.addEventListener("click", closeSidebar);

  document.querySelectorAll(".menu-item").forEach(function(item) {
    item.addEventListener("click", function() {
      goToSection(item.getAttribute("data-section"));
      if (window.innerWidth <= 900) closeSidebar();
    });
  });

  setSidebarCollapsed(window.innerWidth <= 900);
}

function goToSection(sec) {
  // Desconectar listener de sueldos al salir de esa sección
  if (sectionActual === "sueldos" && sec !== "sueldos" && sueldosRef) {
    sueldosRef.off();
    sueldosRef = null;
  }

  document.querySelectorAll(".section").forEach(function(s)  { s.classList.remove("active"); });
  document.querySelectorAll(".menu-item").forEach(function(m) { m.classList.remove("active"); });
  document.getElementById("section-" + sec).classList.add("active");
  document.querySelector("[data-section='" + sec + "']").classList.add("active");
  sectionActual = sec;

  var titles = {
    home:"Dashboard", objetivos:"Objetivos", facturas:"Facturas",
    egresos:"Egresos", merma:"Merma", historial:"Historial", deudas:"Deudas",
    sueldos:"Sueldos", proveedores:"Proveedores"
  };
  document.getElementById("section-title").textContent = titles[sec] || sec;

  if (sec === "objetivos")   renderObjetivos();
  if (sec === "facturas")    renderFacturas();
  if (sec === "egresos")     renderEgresos(periodEgresos);
  if (sec === "merma")       renderMerma();
  if (sec === "historial")   renderHistorial(periodHist);
  if (sec === "deudas")      renderDeudas();
  if (sec === "sueldos")     initSueldos();
  if (sec === "proveedores") renderProveedores();
}

// ===================== SECCIÓN: HOME =====================
function getFechasHome() {
  if (periodHome === "7dias") return ultimosDias(7);
  if (periodHome === "mes")   return diasDeMes(mesOperativo());
  if (periodHome === "periodo") {
    if (!periodHomeDesde || !periodHomeHasta) return [fechaOperativa()];
    return Object.keys(allData).filter(function(f) {
      return f >= periodHomeDesde && f <= periodHomeHasta;
    }).sort();
  }
  return [fechaOperativa()];
}

function renderSucGrid(fechas) {
  var totalIng = 0, totalEg = 0;
  var grid = document.getElementById("suc-grid-home");
  grid.innerHTML = "";

  SUCURSALES.forEach(function(suc) {
    var ing         = fechas.reduce(function(a, f) { return a + sumField(f, suc, "totalIngresos"); }, 0);
    var eg          = fechas.reduce(function(a, f) { return a + sumField(f, suc, "totalEgresos");  }, 0);
    var neto        = ing - eg;
    var totalCargas = fechas.reduce(function(a, f) { return a + getRegs(f, suc).length; }, 0);
    totalIng += ing;
    totalEg  += eg;

    var card = document.createElement("div");
    card.className = "suc-card";
    card.setAttribute("data-suc", suc);
    card.innerHTML =
      '<div class="suc-name">' + suc + '</div>' +
      '<div class="suc-row"><span class="sr-label">Ingresos</span><span class="sr-val ing">' + fmtM(ing) + '</span></div>' +
      '<div class="suc-row"><span class="sr-label">Egresos</span><span class="sr-val eg">'   + fmtM(eg)  + '</span></div>' +
      '<div class="suc-row"><span class="sr-label">Neto</span><span class="sr-val" style="color:' + (neto >= 0 ? "var(--green)" : "var(--red)") + '">' + fmtM(neto) + '</span></div>' +
      '<div class="sr-regs">' + totalCargas + (totalCargas === 1 ? " carga" : " cargas") + '</div>';
    grid.appendChild(card);
  });

  document.getElementById("global-ing").textContent = fmtM(totalIng);
  document.getElementById("global-eg").textContent  = fmtM(totalEg);
  var neto  = totalIng - totalEg;
  var elNet = document.getElementById("global-net");
  elNet.textContent = fmtM(neto);
  elNet.style.color = neto >= 0 ? "var(--green)" : "var(--red)";
}

function renderHome() {
  var fechas = getFechasHome();
  renderSucGrid(fechas);
  renderFeed();
  renderChartsHome(fechas);
  renderSemanal();
}

function initToggleHome() {
  var periodoDiv = document.getElementById("home-periodo-filtro");
  var inputDesde = document.getElementById("home-desde");
  var inputHasta = document.getElementById("home-hasta");

  var hoy = fechaOperativa();
  periodHomeDesde  = hoy;
  periodHomeHasta  = hoy;
  inputDesde.value = hoy;
  inputHasta.value = hoy;

  function applyPeriodHome() {
    var fechas = getFechasHome();
    renderSucGrid(fechas);
    renderChartsHome(fechas);
  }

  document.getElementById("toggle-suc").addEventListener("click", function(e) {
    var btn = e.target.closest(".toggle-btn");
    if (!btn) return;
    document.querySelectorAll("#toggle-suc .toggle-btn").forEach(function(b) { b.classList.remove("active"); });
    btn.classList.add("active");
    periodHome = btn.getAttribute("data-val");
    periodoDiv.style.display = periodHome === "periodo" ? "flex" : "none";
    applyPeriodHome();
  });

  inputDesde.addEventListener("change", function() {
    periodHomeDesde = inputDesde.value;
    applyPeriodHome();
  });
  inputHasta.addEventListener("change", function() {
    periodHomeHasta = inputHasta.value;
    applyPeriodHome();
  });
}

function renderFeed() {
  var container  = document.getElementById("feed-home");
  var filtroTipo = ((document.getElementById("feed-filtro-tipo") || {}).value) || "";
  var filtroSuc  = ((document.getElementById("feed-filtro-suc")  || {}).value) || "";
  var filtroPeriodo = ((document.getElementById("feed-filtro-periodo") || {}).value) || "7";
  var todos      = [];

  Object.keys(allData).forEach(function(fecha) {
    Object.keys(allData[fecha]).forEach(function(suc) {
      allData[fecha][suc].forEach(function(r) {
        todos.push(Object.assign({}, r, { _fecha: fecha, sucursal: r.sucursal || suc }));
      });
    });
  });

  // Include cierres from cache
  if (cierresSnapCache && cierresSnapCache.exists()) {
    cierresSnapCache.forEach(function(daySnap) {
      var fecha = daySnap.key;
      daySnap.forEach(function(sucSnap) {
        var suc = sucSnap.key;
        var d   = sucSnap.val();
        if (d && d.timestamp) {
          todos.push({
            tipo: "cierre", sucursal: suc, _fecha: fecha,
            timestamp: d.timestamp, contado: d.contado,
            diferencia: d.diferencia, nota: d.nota
          });
        }
      });
    });
  }

  todos.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

  if (filtroPeriodo !== "todo") {
    var fechasPermitidas = fechasDePeriodo(filtroPeriodo);
    todos = todos.filter(function(r) { return fechasPermitidas.indexOf(r._fecha) !== -1; });
  }
  if (filtroTipo) todos = todos.filter(function(r) { return r.tipo === filtroTipo; });
  if (filtroSuc)  todos = todos.filter(function(r) { return (r.sucursal || "") === filtroSuc; });

  var ultimos = todos.slice(0, 30);
  if (!ultimos.length) {
    container.innerHTML = '<div class="empty-st">Sin registros' + (filtroTipo || filtroSuc ? ' para los filtros aplicados.' : ' todavía.') + '</div>';
    return;
  }

  container.innerHTML = "";
  ultimos.forEach(function(r) {
    var ts   = new Date(r.timestamp);
    var hora = ts.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
    var fdia = fechaDDMMAAAA(r._fecha);
    var suc  = r.sucursal || "";
    var c    = COLORS[suc] || "#888";
    var div  = document.createElement("div");
    div.className = "feed-item";

    var numsHtml;
    if (r.tipo === "merma") {
      numsHtml = '<span class="feed-badge-tipo feed-merma">📦 Merma · ' + fmtM(r.totalMerma || 0) + '</span>';
    } else if (r.tipo === "cierre") {
      var dif      = r.diferencia || 0;
      var difColor = dif >= 0 ? "var(--green)" : "var(--red)";
      var difStr   = (dif >= 0 ? "+" : "−") + fmtM(Math.abs(dif));
      numsHtml = '<span class="feed-badge-tipo feed-cierre">🔒 Cierre · ' + fmtM(r.contado || 0) +
        (r.diferencia != null ? ' <span style="color:' + difColor + ';font-size:.75rem">(' + difStr + ')</span>' : '') + '</span>';
    } else {
      var ing = regIngresos(r);
      var eg  = regEgresos(r);
      numsHtml =
        '<div class="feed-nums">' +
        (ing ? '<span class="feed-ing">+' + fmtM(ing) + '</span>' : '') +
        (eg  ? '<span class="feed-eg">-'  + fmtM(eg)  + '</span>' : '') +
        '</div>';
    }

    div.innerHTML =
      '<div class="feed-suc" style="background:' + c + '20;color:' + c + '">' + suc + '</div>' +
      '<div class="feed-info">' +
        '<span class="feed-time">' + fdia + ' ' + hora + '</span>' +
        (r.nota ? '<span class="feed-nota">' + esc(r.nota) + '</span>' : '') +
      '</div>' +
      numsHtml;
    container.appendChild(div);
  });
}

function initFeedFilters() {
  var tipSel  = document.getElementById("feed-filtro-tipo");
  var sucSel  = document.getElementById("feed-filtro-suc");
  var periodoSel = document.getElementById("feed-filtro-periodo");
  var clearBtn = document.getElementById("feed-filtro-clear");
  if (tipSel)  tipSel.addEventListener("change", renderFeed);
  if (sucSel)  sucSel.addEventListener("change", renderFeed);
  if (periodoSel) periodoSel.addEventListener("change", renderFeed);
  if (clearBtn) clearBtn.addEventListener("click", function() {
    if (tipSel) tipSel.value = "";
    if (sucSel) sucSel.value = "";
    if (periodoSel) periodoSel.value = "7";
    renderFeed();
  });
}

// ===================== SECCIÓN: CHARTS HOME =====================
function chartLegendPosition(desktopPosition) {
  return window.innerWidth < 768 ? "bottom" : (desktopPosition || "top");
}

function renderChartsHome(fechas) {
  if (!fechas) fechas = getFechasHome();

  var periodLabel;
  if (periodHome === "hoy")       periodLabel = "Hoy";
  else if (periodHome === "7dias") periodLabel = "Últimos 7 días";
  else if (periodHome === "mes")  periodLabel = new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" }).toUpperCase();
  else if (periodHomeDesde && periodHomeHasta)
    periodLabel = periodHomeDesde.split("-").reverse().join("/") + " → " + periodHomeHasta.split("-").reverse().join("/");
  else periodLabel = "Período";

  var subtitleLinea = document.querySelector("#section-home .chart-subtitle");
  if (subtitleLinea) subtitleLinea.textContent = "Ingresos — " + periodLabel;

  var tooltipBase = { backgroundColor: "#1a1a1a", borderColor: "#2a2a2a", borderWidth: 1, titleColor: "#f0f0f0", bodyColor: "#666" };
  var tickSize = window.innerWidth < 768 ? 9 : 10;
  var scalesBase  = {
    x: { ticks: { color: "#555", autoSkip: true, maxTicksLimit: window.innerWidth < 768 ? 7 : 12, font: { size: tickSize } }, grid: { color: "#1f1f1f" } },
    y: { ticks: { color: "#555", font: { size: tickSize }, callback: function(v) { return fmtM(v); } }, grid: { color: "#1f1f1f" } }
  };
  var legendBase  = { position: chartLegendPosition("top"), labels: { color: "#888", font: { size: 10, family: "Space Grotesk" }, boxWidth: 9, usePointStyle: true, padding: 8 } };

  if (!fechas.length) return;

  var labels   = fechas.map(function(d) { return d.slice(5); });
  var datasets = SUCURSALES.map(function(suc) {
    return {
      label: suc,
      data:  fechas.map(function(f) { return sumField(f, suc, "totalIngresos"); }),
      borderColor: COLORS[suc], backgroundColor: COLORS[suc] + "22",
      borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: COLORS[suc],
      fill: false, tension: 0.3
    };
  });

  if (charts.linea) charts.linea.destroy();
  charts.linea = new Chart(document.getElementById("chart-linea"), {
    type: "line",
    data: { labels: labels, datasets: datasets },
    options: { responsive: true, plugins: { legend: legendBase, tooltip: tooltipBase }, scales: scalesBase }
  });

  var totPeriod = SUCURSALES.map(function(suc) {
    return fechas.reduce(function(a, f) { return a + sumField(f, suc, "totalIngresos"); }, 0);
  });
  renderParticipacion(totPeriod);
}

function renderParticipacion(totMes) {
  if (!totMes) {
    var dias = diasDeMes(mesOperativo());
    totMes = SUCURSALES.map(function(suc) {
      return dias.reduce(function(a, f) { return a + sumField(f, suc, "totalIngresos"); }, 0);
    });
  }
  var totalMes    = totMes.reduce(function(a, b) { return a + b; }, 0);
  var tooltipBase = { backgroundColor: "#1a1a1a", borderColor: "#2a2a2a", borderWidth: 1, titleColor: "#f0f0f0", bodyColor: "#888" };

  if (charts.donut) { charts.donut.destroy(); charts.donut = null; }

  if (viewParticipacion === "donut") {
    charts.donut = new Chart(document.getElementById("chart-donut"), {
      type: "doughnut",
      data: {
        labels: SUCURSALES,
        datasets: [{
          data: totMes,
          backgroundColor: SUCURSALES.map(function(s) { return COLORS[s]; }),
          borderColor: "#0a0a0a", borderWidth: 3, hoverOffset: 8
        }]
      },
      options: {
        cutout: "60%",
        responsive: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#aaa", font: { size: 11, family: "Space Grotesk" }, boxWidth: 10, padding: 12,
              generateLabels: function() {
                return SUCURSALES.map(function(suc, i) {
                  var pct = totalMes > 0 ? (totMes[i] / totalMes * 100).toFixed(1) : "0.0";
                  return {
                    text: suc + "  " + pct + "%",
                    fillStyle: COLORS[suc], strokeStyle: COLORS[suc],
                    fontColor: "#aaa", color: "#aaa", index: i
                  };
                });
              }
            }
          },
          tooltip: {
            backgroundColor: "#1a1a1a", borderColor: "#2a2a2a", borderWidth: 1,
            callbacks: {
              label: function(ctx) {
                var pct = totalMes > 0 ? (ctx.raw / totalMes * 100).toFixed(1) : "0.0";
                return "  " + ctx.label + ": " + fmtFull(ctx.raw) + "  (" + pct + "%)";
              }
            }
          }
        }
      }
    });

  } else {
    charts.donut = new Chart(document.getElementById("chart-donut"), {
      type: "bar",
      data: {
        labels: SUCURSALES,
        datasets: [{
          label: "Acumulado mes",
          data: totMes,
          backgroundColor: SUCURSALES.map(function(s) { return COLORS[s] + "cc"; }),
          borderColor:     SUCURSALES.map(function(s) { return COLORS[s]; }),
          borderWidth: 1.5, borderRadius: 6, borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: Object.assign({}, tooltipBase, {
            callbacks: {
              label: function(ctx) {
                var pct = totalMes > 0 ? (ctx.raw / totalMes * 100).toFixed(1) : "0.0";
                return "  " + fmtFull(ctx.raw) + "  (" + pct + "%)";
              }
            }
          })
        },
        scales: {
          x: { ticks: { color: "#888", font: { size: 10, family: "Space Grotesk" } }, grid: { display: false } },
          y: { ticks: { color: "#555", font: { size: 10 }, callback: function(v) { return fmtM(v); } }, grid: { color: "#1f1f1f" } }
        }
      }
    });
  }
}

function initToggleParticipacion() {
  document.getElementById("toggle-participacion").addEventListener("click", function(e) {
    var btn = e.target.closest(".chart-view-btn");
    if (!btn) return;
    document.querySelectorAll("#toggle-participacion .chart-view-btn").forEach(function(b) { b.classList.remove("active"); });
    btn.classList.add("active");
    viewParticipacion = btn.getAttribute("data-val");
    renderParticipacion(null);
  });
}

// ===================== SECCIÓN: OBJETIVOS =====================
function calcDiasHabiles() {
  var hoy    = new Date();
  var anio   = hoy.getFullYear();
  var mes    = hoy.getMonth();
  var ultimo = new Date(anio, mes + 1, 0).getDate();
  var transcurridos = 0, restantes = 0, totales = 0;

  for (var d = 1; d <= ultimo; d++) {
    if (new Date(anio, mes, d).getDay() === 0) continue; // saltar domingos
    totales++;
    if (d <= hoy.getDate()) transcurridos++;
    else                    restantes++;
  }
  return { transcurridos: transcurridos, restantes: restantes, totales: totales };
}

function renderObjetivos(obj) {
  var mes = objetivosMesViendo || mesOperativo();
  if (!obj) obj = todosObjetivos[mes] || Object.assign({}, OBJETIVOS_DEFAULT);
  var esActual = mes === mesOperativo();

  // Actualizar label del mes
  var mesN    = parseInt(mes.slice(5, 7));
  var nombres = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  var labelEl = document.getElementById("obj-mes-label");
  if (labelEl) labelEl.textContent = nombres[mesN] + " " + mes.slice(0, 4);

  // Deshabilitar botón "siguiente" si ya estamos en el mes actual
  var btnNext = document.getElementById("obj-mes-next");
  if (btnNext) btnNext.disabled = esActual;

  var dias  = diasDeMes(mes);
  var habil = calcDiasHabiles();
  var cont  = document.getElementById("obj-cards");
  cont.innerHTML = "";
  cont.classList.toggle("obj-list-view", objetivosView === "list");
  var sucursalFiltro = document.getElementById("obj-sucursal-filtro").value;

  // Para meses pasados: habil refiere al mes viendo, no al actual
  var habilMes = esActual ? habil : (function() {
    var anio = parseInt(mes.slice(0,4)), mesN2 = parseInt(mes.slice(5,7)) - 1;
    var ultimo = new Date(anio, mesN2 + 1, 0).getDate();
    var tot = 0;
    for (var d = 1; d <= ultimo; d++) {
      if (new Date(anio, mesN2, d).getDay() !== 0) tot++;
    }
    return { transcurridos: tot, restantes: 0, totales: tot };
  })();

  // Card global
  var acumTotal = 0, metaTotal = 0;
  SUCURSALES.forEach(function(suc) {
    acumTotal += dias.reduce(function(a, f) { return a + sumField(f, suc, "totalIngresos"); }, 0);
    metaTotal += obj[suc] || 0;
  });
  var pctTotal       = metaTotal > 0 ? Math.min((acumTotal / metaTotal) * 100, 100) : 0;
  var pctRealGlobal  = metaTotal > 0 ? ((acumTotal / metaTotal) * 100).toFixed(1) : "0.0";
  var faltaTotal     = Math.max(metaTotal - acumTotal, 0);
  var barColorGlobal = pctTotal >= 80 ? "var(--green)" : pctTotal >= 50 ? "#f0a500" : "var(--red)";
  var promReqGlobal  = (habilMes.restantes > 0 && faltaTotal > 0) ? faltaTotal / habilMes.restantes : 0;
  var promRealGlobal = habilMes.transcurridos > 0 ? acumTotal / habilMes.transcurridos : 0;

  var globalSubHtml;
  if (acumTotal >= metaTotal && metaTotal > 0) {
    globalSubHtml = '<span style="color:var(--green);font-weight:700">✓ Objetivo global alcanzado</span>';
  } else if (!esActual) {
    globalSubHtml = '<span style="color:#f0a500;font-weight:600">📈 En progreso · ' +
      fmtFull(acumTotal) + ' de ' + fmtFull(metaTotal) + '</span>';
  } else {
    globalSubHtml = '<span>Promedio req. <strong style="color:' + barColorGlobal + '">' + fmtFull(Math.ceil(promReqGlobal)) + '/día</strong> · ' +
      habilMes.restantes + ' días hábiles restantes · Prom. real: ' + fmtM(Math.round(promRealGlobal)) + '/día</span>';
  }

  var globalCard = document.createElement("div");
  globalCard.className = "obj-global-card";
  globalCard.innerHTML =
    '<div class="obj-global-top">' +
      '<div>' +
        '<div class="obj-global-label">Objetivo global — ' + nombres[mesN] + ' ' + mes.slice(0,4) + '</div>' +
        '<div class="obj-global-vals">' +
          '<span class="obj-global-acum">' + fmtFull(acumTotal) + '</span>' +
          '<span class="obj-global-sep">/</span>' +
          '<span class="obj-global-meta">' + fmtFull(metaTotal) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="obj-global-pct" style="color:' + barColorGlobal + '">' + pctRealGlobal + '%</div>' +
    '</div>' +
    '<div class="obj-bar-bg" style="height:8px;margin:10px 0 6px">' +
      '<div class="obj-bar-fill" style="width:' + pctTotal + '%;background:' + barColorGlobal + ';height:8px;border-radius:4px"></div>' +
    '</div>' +
    '<div class="obj-global-sub">' + globalSubHtml + '</div>';
  cont.appendChild(globalCard);

  // Cards por sucursal
  SUCURSALES.forEach(function(suc) {
    if (sucursalFiltro && sucursalFiltro !== suc) return;
    var acum     = dias.reduce(function(a, f) { return a + sumField(f, suc, "totalIngresos"); }, 0);
    var meta     = obj[suc] || 0;
    var falta    = Math.max(meta - acum, 0);
    var pct      = meta > 0 ? Math.min((acum / meta) * 100, 100) : 0;
    var pctReal  = meta > 0 ? ((acum / meta) * 100).toFixed(1) : "0.0";
    var barColor = pct >= 80 ? "var(--green)" : pct >= 50 ? "#f0a500" : "var(--red)";
    var promReq  = (habilMes.restantes > 0 && falta > 0) ? falta / habilMes.restantes : 0;
    var promReal = habilMes.transcurridos > 0 ? acum / habilMes.transcurridos : 0;
    var yaAlcanzo = acum >= meta && meta > 0;

    var promHtml;
    if (yaAlcanzo) {
      promHtml = '<div class="obj-prom-row obj-prom-ok">✓ Objetivo alcanzado</div>';
    } else if (!esActual) {
      promHtml = '<div class="obj-prom-row" style="border-color:var(--red-dim);background:var(--red-dim)">' +
        '<span class="obj-prom-label" style="color:var(--muted2)">Faltan</span>' +
        '<span class="obj-prom-val" style="color:#f0a500">−' + fmtFull(falta) + '</span>' +
        '</div>';
    } else if (habilMes.restantes === 0) {
      promHtml = '<div class="obj-prom-row obj-prom-warn">Sin días hábiles restantes</div>';
    } else {
      var promColor = promReq <= promReal ? "var(--green)" : promReq <= promReal * 1.3 ? "#f0a500" : "var(--red)";
      promHtml =
        '<div class="obj-prom-row">' +
          '<span class="obj-prom-label">Prom. requerido</span>' +
          '<span class="obj-prom-val" style="color:' + promColor + '">' + fmtFull(Math.ceil(promReq)) + '/día</span>' +
        '</div>' +
        '<div class="obj-prom-sub">' +
          '<span>Prom. real: ' + fmtM(Math.round(promReal)) + '/día</span>' +
        '</div>';
    }

    var card = document.createElement("div");
    card.className = "obj-card";
    card.setAttribute("data-suc", suc);
    var comprasFacturas = allFacturas.reduce(function(total, factura) {
      return total + (factura.sucursal === suc && factura.fecha && factura.fecha.slice(0, 7) === mes ? Number(factura.monto) || 0 : 0);
    }, 0);
    // Egresos de efectivo del mes (movimientos de caja), excepto la categoría "retiro"
    var comprasEgresos = dias.reduce(function(total, fecha) {
      return total + RUBROS_EG.reduce(function(sub, rubro) {
        return rubro.id === "retiro" ? sub : sub + sumRubro(fecha, suc, "egresos", rubro.id);
      }, 0);
    }, 0);
    var totalCompras = comprasFacturas + comprasEgresos;
    var totalMerma = dias.reduce(function(total, fecha) {
      return total + getMermaRegs(fecha, suc).reduce(function(subtotal, reg) { return subtotal + (reg.totalMerma || 0); }, 0);
    }, 0);
    var empleadosSucursal = allEmpleados.filter(function(emp) { return emp.sucursal === suc; });
    var sueldoBaseSucursal = empleadosSucursal.reduce(function(total, emp) { return total + (Number(emp.sueldoBase) || 0); }, 0);
    card.innerHTML =
      '<div class="obj-top">' +
        '<span class="obj-suc-name">' + suc + '</span>' +
        '<span class="obj-pct" style="color:' + barColor + '">' + pctReal + '%</span>' +
      '</div>' +
      '<div class="obj-bar-bg"><div class="obj-bar-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div>' +
      '<div class="obj-nums">' +
        '<span class="obj-acum">' + fmtFull(acum) + '</span>' +
        '<span class="obj-meta">Obj: ' + fmtFull(meta) + '</span>' +
      '</div>' +
      promHtml +
      '<div class="obj-sucursal-resumen">' +
        '<div class="obj-res-item"><span>Ventas del mes</span><strong>' + fmtM(acum) + '</strong></div>' +
        '<div class="obj-res-item" title="Facturas: ' + fmtFull(comprasFacturas) + ' · Egresos efectivo: ' + fmtFull(comprasEgresos) + '"><span>Compras del mes</span><strong>' + fmtM(totalCompras) + '</strong></div>' +
        '<div class="obj-res-item"><span>Empleados</span><strong>' + empleadosSucursal.length + '</strong></div>' +
        '<div class="obj-res-item"><span>Merma del mes</span><strong>' + fmtM(totalMerma) + '</strong></div>' +
        '<div class="obj-res-item"><span>Sueldo base</span><strong>' + fmtM(sueldoBaseSucursal) + '</strong></div>' +
      '</div>';
    cont.appendChild(card);
  });
}

function initObjetivosModal() {
  objetivosMesViendo = mesActual();

  var btnEdit   = document.getElementById("btn-edit-obj");
  var modal     = document.getElementById("obj-modal");
  var btnCancel = document.getElementById("btn-cancel-obj");
  var btnSave   = document.getElementById("btn-save-obj");
  var fields    = document.getElementById("obj-fields");

  document.getElementById("obj-sucursal-filtro").addEventListener("change", renderObjetivos);
  document.getElementById("obj-view-toggle").addEventListener("click", function(e) {
    var button = e.target.closest("button[data-view]");
    if (!button) return;
    objetivosView = button.getAttribute("data-view");
    document.querySelectorAll("#obj-view-toggle button").forEach(function(item) { item.classList.toggle("active", item === button); });
    renderObjetivos();
  });

  document.getElementById("obj-mes-prev").addEventListener("click", function() {
    objetivosMesViendo = sumarMes(objetivosMesViendo, -1);
    renderObjetivos();
  });
  document.getElementById("obj-mes-next").addEventListener("click", function() {
    objetivosMesViendo = sumarMes(objetivosMesViendo, +1);
    renderObjetivos();
  });

  btnEdit.addEventListener("click", function() {
    pedirClaveAdmin().then(function(ok) {
      if (!ok) { alert("Clave incorrecta."); return; }
      var mes = objetivosMesViendo || mesOperativo();
      var obj = todosObjetivos[mes] || Object.assign({}, OBJETIVOS_DEFAULT);
      fields.innerHTML = "";
      SUCURSALES.forEach(function(suc) {
        var row = document.createElement("div");
        row.className = "obj-field-row";
        row.innerHTML =
          '<label>' + suc + '</label>' +
          '<div class="obj-input-wrap">' +
            '<span class="obj-prefix">$</span>' +
            '<input type="number" id="obj-inp-' + suc + '" value="' + (obj[suc] || 0) + '" min="0" step="100000">' +
          '</div>';
        fields.appendChild(row);
      });
      modal.classList.remove("hidden");
    });
  });

  btnCancel.addEventListener("click", function() { modal.classList.add("hidden"); });

  btnSave.addEventListener("click", function() {
    var mes = objetivosMesViendo || mesOperativo();
    var obj = {};
    SUCURSALES.forEach(function(suc) {
      obj[suc] = parseFloat(document.getElementById("obj-inp-" + suc).value) || 0;
    });
    btnSave.disabled    = true;
    btnSave.textContent = "Guardando...";
    firebase.database().ref("config/objetivos/" + mes).set(obj)
      .then(function() { modal.classList.add("hidden"); })
      .catch(function(e) { alert("Error al guardar objetivos: " + e.message); })
      .finally(function() { btnSave.disabled = false; btnSave.textContent = "Guardar"; });
  });
}

// ===================== SECCIÓN: FACTURAS =====================
function semanasDelMes(mes) {
  var anio   = parseInt(mes.slice(0, 4));
  var mesN   = parseInt(mes.slice(5, 7)) - 1;
  var primer = new Date(anio, mesN, 1);
  var ultimo = new Date(anio, mesN + 1, 0);
  var semanas = [], sem = 1;
  var d = new Date(primer);

  while (d <= ultimo) {
    var desde = localDateStr(d);
    var fin   = new Date(d);
    fin.setDate(fin.getDate() + (6 - fin.getDay()));
    if (fin > ultimo) fin = new Date(ultimo);
    semanas.push({ label: "SEM " + sem, desde: desde, hasta: localDateStr(fin) });
    sem++;
    d = new Date(fin);
    d.setDate(d.getDate() + 1);
  }
  return semanas;
}

function renderFacturas() {
  var mes     = facturasMesViendo;
  var mesN    = parseInt(mes.slice(5, 7));
  var nombres = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  document.getElementById("fact-mes-label").textContent = nombres[mesN] + " " + mes.slice(0, 4);

  var semanas  = semanasDelMes(mes);
  var del_mes  = (allFacturas || []).filter(function(f) { return f.fecha && f.fecha.slice(0, 7) === mes; });
  del_mes.sort(function(a, b) { return b.fecha.localeCompare(a.fecha); });
  renderTopFacturas(del_mes);
  var totalFacturadoMes = del_mes.reduce(function(total, factura) { return total + (Number(factura.monto) || 0); }, 0);
  document.getElementById("fact-kpis").innerHTML =
    '<div class="global-card"><div class="gc-label">Facturado del mes</div><div class="gc-val green">' + fmtFull(totalFacturadoMes) + '</div></div>' +
    '<div class="global-card"><div class="gc-label">Facturas del mes</div><div class="gc-val">' + del_mes.length + '</div></div>' +
    '<div class="global-card"><div class="gc-label">Promedio por factura</div><div class="gc-val">' + fmtFull(del_mes.length ? totalFacturadoMes / del_mes.length : 0) + '</div></div>';

  // Resumen semanas × sucursal
  var thead = document.getElementById("fact-resumen-thead");
  var tbody = document.getElementById("fact-resumen-tbody");
  thead.innerHTML = "<tr><th>Sucursal</th>" + semanas.map(function(s) { return "<th>" + s.label + "</th>"; }).join("") + "<th>Total</th></tr>";

  var totSem    = semanas.map(function() { return 0; });
  var totGlobal = 0;
  tbody.innerHTML = "";

  SUCURSALES.forEach(function(suc) {
    var c      = COLORS[suc];
    var rowTot = 0;
    var celdas = semanas.map(function(s, i) {
      var sum = del_mes.filter(function(f) {
        return f.sucursal === suc && f.fecha >= s.desde && f.fecha <= s.hasta;
      }).reduce(function(a, f) { return a + (f.monto || 0); }, 0);
      totSem[i] += sum;
      rowTot    += sum;
      totGlobal += sum;
      return "<td class='fact-td-num'>" + (sum ? fmtFull(sum) : "<span class='fact-empty'>—</span>") + "</td>";
    });
    var tr = document.createElement("tr");
    tr.innerHTML =
      "<td><span class='fact-suc-badge' style='color:" + c + "'>" + suc + "</span></td>" +
      celdas.join("") +
      "<td class='fact-td-tot'>" + (rowTot ? fmtFull(rowTot) : "—") + "</td>";
    tbody.appendChild(tr);
  });

  var trTot = document.createElement("tr");
  trTot.className = "fact-row-total";
  trTot.innerHTML =
    "<td>TOTAL</td>" +
    totSem.map(function(t) { return "<td class='fact-td-num'>" + (t ? fmtFull(t) : "—") + "</td>"; }).join("") +
    "<td class='fact-td-tot'>" + (totGlobal ? fmtFull(totGlobal) : "—") + "</td>";
  tbody.appendChild(trTot);

  // Lista detallada con filtros
  var filtroSuc    = (document.getElementById("filtro-sucursal")    || {}).value || "";
  var filtroProv   = ((document.getElementById("filtro-proveedor")  || {}).value || "").trim().toLowerCase();
  var filtroDesde  = (document.getElementById("filtro-fecha-desde") || {}).value || "";
  var filtroHasta  = (document.getElementById("filtro-fecha-hasta") || {}).value || "";

  var listaTbody = document.getElementById("fact-lista-tbody");
  listaTbody.innerHTML = "";

  var baseLista = filtroDesde || filtroHasta ? allFacturas : del_mes;
  var filtradas = baseLista.filter(function(f) {
    if (filtroSuc  && f.sucursal !== filtroSuc) return false;
    if (filtroProv && !(f.proveedor || "").toLowerCase().includes(filtroProv)) return false;
    if (filtroDesde && f.fecha < filtroDesde) return false;
    if (filtroHasta && f.fecha > filtroHasta) return false;
    return true;
  });

  if (!filtradas.length) {
    listaTbody.innerHTML = "<tr><td colspan='6' class='fact-empty-row'>" +
      (baseLista.length ? "Sin facturas para los filtros aplicados." : "Sin facturas para este mes.") +
      "</td></tr>";
    return;
  }

  filtradas.forEach(function(f) {
    var c  = COLORS[f.sucursal] || "#888";
    var tr = document.createElement("tr");
    tr.innerHTML =
      "<td><span class='fact-suc-badge' style='color:" + c + "'>" + f.sucursal + "</span></td>" +
      "<td class='fact-td-prov'>"  + esc(f.proveedor || "—") + "</td>" +
      "<td class='fact-td-num'>"   + esc(f.numero    || "—") + "</td>" +
      "<td class='fact-td-fecha'>" + fechaDDMMAAAA(f.fecha) + "</td>" +
      "<td class='fact-td-monto'>" + fmtFull(f.monto || 0) + "</td>" +
      "<td><button class='fact-btn-del' data-id='" + f._id + "'>✕</button></td>";
    listaTbody.appendChild(tr);
  });

  listaTbody.querySelectorAll(".fact-btn-del").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var id = btn.getAttribute("data-id");
      pedirClaveAdmin().then(function(ok) {
        if (!ok) { alert("Clave incorrecta."); return; }
        if (!confirm("¿Eliminar esta factura?")) return;
        firebase.database().ref("facturas/" + id).remove();
      });
    });
  });
}

function renderTopFacturas(facturas) {
  if (!window.Chart) return;
  var lookup = buildProvLookup();
  var totales = {};
  facturas.forEach(function(f) {
    var id = f.proveedor ? lookup[f.proveedor.toLowerCase()] : null;
    var proveedor = allProveedores.find(function(item) { return item._id === id; });
    var nombre = proveedor ? proveedor.nombre : (f.proveedor || "Sin proveedor");
    if (!totales[nombre]) totales[nombre] = { monto: 0, cantidad: 0 };
    totales[nombre].monto += Number(f.monto) || 0;
    totales[nombre].cantidad++;
  });
  var ordenMonto = Object.keys(totales).sort(function(a, b) { return totales[b].monto - totales[a].monto; }).slice(0, 5);
  var ordenCantidad = Object.keys(totales).sort(function(a, b) { return totales[b].cantidad - totales[a].cantidad; }).slice(0, 5);
  ["facturasMonto", "facturasCantidad"].forEach(function(key) {
    if (charts[key]) charts[key].destroy();
  });
  charts.facturasMonto = new Chart(document.getElementById("chart-facturas-monto"), {
    type: "bar",
    data: { labels: ordenMonto, datasets: [{ data: ordenMonto.map(function(n) { return totales[n].monto; }), backgroundColor: "#00e676aa", borderRadius: 4 }] },
    options: { indexAxis: "y", responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(ctx) { return fmtFull(ctx.raw); } } } }, scales: { x: { ticks: { color: "#888", callback: function(v) { return fmtM(v); } }, grid: { color: "#252525" } }, y: { ticks: { color: "#aaa" }, grid: { display: false } } } }
  });
  charts.facturasCantidad = new Chart(document.getElementById("chart-facturas-cantidad"), {
    type: "bar",
    data: { labels: ordenCantidad, datasets: [{ data: ordenCantidad.map(function(n) { return totales[n].cantidad; }), backgroundColor: "#4da6ffbb", borderRadius: 4 }] },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(ctx) { return ctx.raw + " facturas"; } } }
      },
      scales: {
        x: { ticks: { color: "#888", precision: 0 }, grid: { color: "#252525" } },
        y: { ticks: { color: "#aaa" }, grid: { display: false } }
      }
    }
  });
}

function guardarFactura() {
  var suc    = document.getElementById("fact-sucursal").value;
  var prov   = document.getElementById("fact-proveedor").value.trim();
  var numero = document.getElementById("fact-numero").value.trim();
  var fecha  = document.getElementById("fact-fecha").value;
  var monto  = parseFloat(document.getElementById("fact-monto").value) || 0;

  if (!suc)   { alert("Seleccioná una sucursal."); return; }
  if (!prov)  { alert("Ingresá el proveedor."); return; }
  if (!fecha) { alert("Ingresá la fecha."); return; }
  if (!monto) { alert("Ingresá el monto."); return; }

  var btn = document.getElementById("btn-guardar-fact");
  btn.disabled    = true;
  btn.textContent = "Verificando...";

  pedirClaveAdmin().then(function(ok) {
    if (!ok) {
      alert("Clave incorrecta. No se guardó la factura.");
      btn.disabled    = false;
      btn.textContent = "+ Cargar Factura";
      return;
    }
    btn.textContent = "Guardando...";
    firebase.database().ref("facturas").push({
      sucursal: suc, proveedor: prov, numero: numero,
      fecha: fecha, monto: monto, timestamp: Date.now()
    })
    .then(function() {
      document.getElementById("fact-sucursal").value  = "";
      document.getElementById("fact-proveedor").value = "";
      document.getElementById("fact-numero").value    = "";
      document.getElementById("fact-fecha").value     = today();
      document.getElementById("fact-monto").value     = "";
    })
    .catch(function(e) { alert("Error al guardar: " + e.message); })
    .finally(function() { btn.disabled = false; btn.textContent = "+ Cargar Factura"; });
  });
}

function exportarFacturasCSV() {
  var mes   = facturasMesViendo;
  var lista = (allFacturas || []).filter(function(f) { return f.fecha && f.fecha.slice(0, 7) === mes; });
  if (!lista.length) { alert("No hay facturas para exportar en este mes."); return; }
  lista.sort(function(a, b) { return a.fecha.localeCompare(b.fecha); });

  var csv = "Sucursal,Proveedor,N° Factura,Fecha,Monto\n";
  lista.forEach(function(f) {
    csv += [
      f.sucursal,
      '"' + (f.proveedor || "").replace(/"/g, '""') + '"',
      '"' + (f.numero    || "") + '"',
      f.fecha ? f.fecha.split("-").reverse().join("/") : "",
      f.monto || 0
    ].join(",") + "\n";
  });

  var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement("a");
  a.href     = url;
  a.download = "facturas-" + mes + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

function initFacturas() {
  facturasMesViendo = mesActual();
  document.getElementById("fact-fecha").value = today();
  document.getElementById("btn-guardar-fact").addEventListener("click", guardarFactura);
  document.getElementById("btn-export-facturas").addEventListener("click", exportarFacturasCSV);
  document.getElementById("btn-ver-proveedores").addEventListener("click", function() { goToSection("proveedores"); });

  document.getElementById("filtro-sucursal").addEventListener("change", renderFacturas);
  document.getElementById("filtro-proveedor").addEventListener("input", renderFacturas);
  document.getElementById("filtro-fecha-desde").addEventListener("change", renderFacturas);
  document.getElementById("filtro-fecha-hasta").addEventListener("change", renderFacturas);
  document.getElementById("btn-limpiar-filtros").addEventListener("click", function() {
    document.getElementById("filtro-sucursal").value    = "";
    document.getElementById("filtro-proveedor").value   = "";
    document.getElementById("filtro-fecha-desde").value = "";
    document.getElementById("filtro-fecha-hasta").value = "";
    renderFacturas();
  });
  document.getElementById("fact-mes-prev").addEventListener("click", function() {
    facturasMesViendo = sumarMes(facturasMesViendo, -1);
    renderFacturas();
  });
  document.getElementById("fact-mes-next").addEventListener("click", function() {
    facturasMesViendo = sumarMes(facturasMesViendo, +1);
    renderFacturas();
  });
}

// ===================== SECCIÓN: EGRESOS =====================
function showEgresoDetail(suc, rubroId, fechas) {
  var modal    = document.getElementById("egreso-detail-modal");
  var titleEl  = document.getElementById("egreso-detail-title");
  var bodyEl   = document.getElementById("egreso-detail-body");
  var closeBtn = document.getElementById("egreso-detail-close");
  if (!modal) return;

  var rubroLabel = (RUBROS_EG.find(function(r) { return r.id === rubroId; }) || {}).label || rubroId;
  titleEl.textContent = suc + " · " + rubroLabel;

  var registros = [];
  fechas.forEach(function(fecha) {
    getRegs(fecha, suc).forEach(function(r) {
      if ((r.tipo === "movimientos" || !r.tipo) && r.egresos && r.egresos[rubroId]) {
        registros.push({ fecha: fecha, monto: r.egresos[rubroId], nota: r.nota || "", timestamp: r.timestamp || 0 });
      }
    });
  });
  registros.sort(function(a, b) { return b.timestamp - a.timestamp; });

  if (!registros.length) {
    bodyEl.innerHTML = '<div class="empty-st" style="padding:20px 0">Sin registros para este rubro en el período.</div>';
  } else {
    var total = registros.reduce(function(a, r) { return a + r.monto; }, 0);
    var rows  = registros.map(function(r) {
      var hora = r.timestamp ? new Date(r.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
      return '<tr style="border-bottom:1px solid var(--border)">' +
        '<td style="padding:7px 6px">' + r.fecha.split("-").reverse().join("/") + '</td>' +
        '<td style="padding:7px 6px;color:var(--muted);font-size:.78rem">' + hora + '</td>' +
        '<td style="padding:7px 6px;color:var(--muted)">' + esc(r.nota || '—') + '</td>' +
        '<td style="padding:7px 6px;text-align:right;color:var(--red);font-weight:600">' + fmtFull(r.monto) + '</td>' +
        '</tr>';
    }).join("");
    bodyEl.innerHTML =
      '<table style="width:100%;border-collapse:collapse;font-size:.82rem">' +
        '<thead><tr style="color:var(--muted);border-bottom:2px solid var(--border)">' +
          '<th style="text-align:left;padding:6px">Fecha</th>' +
          '<th style="text-align:left;padding:6px">Hora</th>' +
          '<th style="text-align:left;padding:6px">Nota</th>' +
          '<th style="text-align:right;padding:6px">Monto</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '<tfoot><tr style="border-top:2px solid var(--border);font-weight:700">' +
          '<td colspan="3" style="padding:8px 6px">Total</td>' +
          '<td style="text-align:right;padding:8px 6px;color:var(--red)">' + fmtFull(total) + '</td>' +
        '</tr></tfoot>' +
      '</table>';
  }

  modal.classList.remove("hidden");
  closeBtn.onclick = function() { modal.classList.add("hidden"); };
  modal.onclick = function(e) { if (e.target === modal) modal.classList.add("hidden"); };
}

function renderEgresos(period) {
  if (period) periodEgresos = period;
  period = periodEgresos;
  var fechas  = fechasDePeriodo(period, document.getElementById("egresos-desde").value, document.getElementById("egresos-hasta").value);
  var filtroSuc = document.getElementById("egresos-sucursal").value;
  var sucursales = filtroSuc ? [filtroSuc] : SUCURSALES;
  var totales = {};
  RUBROS_EG.forEach(function(r) { totales[r.id] = 0; });

  fechas.forEach(function(f) {
    sucursales.forEach(function(suc) {
      RUBROS_EG.forEach(function(r) {
        totales[r.id] += sumRubro(f, suc, "egresos", r.id);
      });
    });
  });

  var labels = RUBROS_EG.map(function(r) { return r.label; });
  var data   = RUBROS_EG.map(function(r) { return totales[r.id]; });
  var colors = ["#ff6b6b", "#f0a500", "#4da6ff", "#c084fc", "#888"];
  var totalEgresosPeriodo = data.reduce(function(total, monto) { return total + monto; }, 0);
  var categoriaPrincipal = labels[data.indexOf(Math.max.apply(null, data))] || "—";
  document.getElementById("egresos-kpis").innerHTML =
    '<div class="global-card"><div class="gc-label">Egresos del período</div><div class="gc-val red">' + fmtFull(totalEgresosPeriodo) + '</div></div>' +
    '<div class="global-card"><div class="gc-label">Promedio diario</div><div class="gc-val">' + fmtFull(fechas.length ? totalEgresosPeriodo / fechas.length : 0) + '</div></div>' +
    '<div class="global-card"><div class="gc-label">Mayor categoría</div><div class="gc-val">' + (totalEgresosPeriodo ? categoriaPrincipal : '—') + '</div></div>';

  if (charts.egresosDonut) charts.egresosDonut.destroy();
  var periodoLabel = period === "custom" ? "Período personalizado" : period === "mes" ? "Mes actual" : period === "anterior" ? "Mes anterior" : period === "hoy" ? "Hoy" : "Últimos " + (period === "semana" ? 7 : period) + " días";
  document.querySelector("#section-egresos .chart-subtitle").textContent = "Distribución · " + (filtroSuc || "todas las sucursales") + " · " + periodoLabel;
  charts.egresosDonut = new Chart(document.getElementById("chart-egresos-donut"), {
    type: "doughnut",
    data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderColor: "#111", borderWidth: 2, hoverOffset: 5 }] },
    options: {
      cutout: "72%",
      responsive: true,
      plugins: {
        legend: { position: chartLegendPosition("right"), labels: { color: "#888", font: { size: window.innerWidth < 768 ? 9 : 10, family: "Space Grotesk" }, boxWidth: 8, padding: 8, usePointStyle: true } },
        tooltip: { backgroundColor: "#1a1a1a", callbacks: {
          label: function(ctx) {
            var t = ctx.dataset.data.reduce(function(a, b) { return a + b; }, 0);
            return "  " + ctx.label + ": " + fmtM(ctx.raw) + " (" + (t > 0 ? (ctx.raw / t * 100).toFixed(1) : 0) + "%)";
          }
        }}
      }
    }
  });

  var cont = document.getElementById("egresos-detalle");
  cont.innerHTML = "";
  sucursales.forEach(function(suc) {
    var suctot = fechas.reduce(function(a, f) { return a + sumField(f, suc, "totalEgresos"); }, 0);
    if (!suctot) return;
    var card = document.createElement("div");
    card.className = "detalle-suc-card";
    var html = '<div class="detalle-suc-title">' + suc + '</div>';
    RUBROS_EG.forEach(function(r) {
      var val = fechas.reduce(function(a, f) { return a + sumRubro(f, suc, "egresos", r.id); }, 0);
      if (!val) return;
      var pct = suctot > 0 ? (val / suctot * 100) : 0;
      html +=
        '<div class="detalle-row" data-suc="' + suc + '" data-rubro="' + r.id + '" style="cursor:pointer" title="Ver detalle · ' + r.label + '">' +
          '<span class="detalle-row-label">' + r.label + '</span>' +
          '<div class="detalle-row-right">' +
            '<div class="detalle-mini-bar-bg"><div class="detalle-mini-bar-fill" style="width:' + pct + '%;background:var(--red)"></div></div>' +
            '<span class="detalle-row-val">' + fmtM(val) + '</span>' +
          '</div>' +
        '</div>';
    });
    card.innerHTML = html;
    // Capture fechas in closure for click handler
    (function(f) {
      card.addEventListener("click", function(e) {
        var row = e.target.closest(".detalle-row[data-suc]");
        if (!row) return;
        showEgresoDetail(row.getAttribute("data-suc"), row.getAttribute("data-rubro"), f);
      });
    })(fechas.slice());
    cont.appendChild(card);
  });
  if (!cont.children.length) cont.innerHTML = '<div class="empty-st">Sin egresos para los filtros seleccionados.</div>';
}

function initToggleEgresos() {
  initReportFilter("egresos-filtros", "egresos", periodEgresos, function(period) {
    periodEgresos = period;
    renderEgresos(period);
  });
}

// ===================== SECCIÓN: MERMA =====================
function renderMerma() {
  var fechasMes = fechasDePeriodo(periodMerma, document.getElementById("merma-desde").value, document.getElementById("merma-hasta").value);
  var filtroSuc = document.getElementById("merma-sucursal").value;
  var sucursales = filtroSuc ? [filtroSuc] : SUCURSALES;
  var strip     = document.getElementById("merma-global-strip");
  var detCont   = document.getElementById("merma-detalle");
  strip.innerHTML   = "";
  detCont.innerHTML = "";

  var totalGlobal    = 0;

  var totalesPorSuc = {};
  SUCURSALES.forEach(function(suc) { totalesPorSuc[suc] = 0; });

  fechasMes.forEach(function(f) {
    sucursales.forEach(function(suc) {
      getMermaRegs(f, suc).forEach(function(r) {
        var t = r.totalMerma || 0;
        totalGlobal        += t;
        totalesPorSuc[suc] += t;
      });
    });
  });

  // Strip global
  var stripHtml =
    '<div class="merma-strip-card merma-strip-total">' +
      '<div class="ms-label">Total período</div>' +
      '<div class="ms-val">' + fmtM(totalGlobal) + '</div>' +
    '</div>';
  sucursales.forEach(function(suc) {
    var pct = totalGlobal > 0 ? (totalesPorSuc[suc] / totalGlobal * 100).toFixed(1) : "0.0";
    stripHtml +=
      '<div class="merma-strip-card">' +
        '<div class="ms-suc" style="color:' + COLORS[suc] + '">' + suc + '</div>' +
        '<div class="ms-val">' + fmtM(totalesPorSuc[suc]) + '</div>' +
        '<div class="ms-pct">' + pct + '%</div>' +
      '</div>';
  });
  strip.innerHTML = stripHtml;

  if (!totalGlobal) {
    detCont.innerHTML = '<div class="empty-st" style="padding:40px 0">Sin registros de merma este mes.</div>';
    return;
  }

  sucursales.forEach(function(suc) {
    if (!totalesPorSuc[suc]) return;
    var itemsAgrup = {};

    fechasMes.forEach(function(f) {
      getMermaRegs(f, suc).forEach(function(r) {
        (r.items || []).forEach(function(item) {
          var key = item.producto;
          if (!itemsAgrup[key]) itemsAgrup[key] = { cantidad: 0, total: 0, motivos: {} };
          itemsAgrup[key].cantidad += item.cantidad || 0;
          itemsAgrup[key].total    += item.total    || 0;
          var mot = item.motivo || "otros";
          itemsAgrup[key].motivos[mot] = (itemsAgrup[key].motivos[mot] || 0) + (item.cantidad || 0);
        });
      });
    });

    var c    = COLORS[suc];
    var rows = "";
    Object.keys(itemsAgrup)
      .sort(function(a, b) { return itemsAgrup[b].total - itemsAgrup[a].total; })
      .forEach(function(prod) {
        var it     = itemsAgrup[prod];
        var pct    = totalesPorSuc[suc] > 0 ? (it.total / totalesPorSuc[suc] * 100) : 0;
        var motTop = Object.keys(it.motivos).sort(function(a, b) { return it.motivos[b] - it.motivos[a]; })[0];
        rows +=
          '<tr>' +
            '<td class="merma-td-prod">'   + esc(prod) + '</td>' +
            '<td class="merma-td-num">'    + it.cantidad + ' u.</td>' +
            '<td class="merma-td-motivo">' + esc(MOTIVOS_MERMA[motTop] || motTop) + '</td>' +
            '<td class="merma-td-tot">'    + fmtM(it.total) + '</td>' +
            '<td class="merma-td-bar"><div class="merma-mini-bar"><div style="width:' + pct + '%;background:' + c + '"></div></div></td>' +
          '</tr>';
      });

    var card = document.createElement("div");
    card.className = "merma-suc-card";
    card.setAttribute("data-suc", suc);
    card.innerHTML =
      '<div class="merma-suc-header">' +
        '<span class="merma-suc-name" style="color:' + c + '">' + suc + '</span>' +
        '<span class="merma-suc-total">' + fmtFull(totalesPorSuc[suc]) + '</span>' +
      '</div>' +
      '<div class="merma-tabla-wrap">' +
        '<table class="merma-tabla">' +
          '<thead><tr><th>Producto</th><th>Cant.</th><th>Motivo</th><th>Total</th><th></th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>';
    detCont.appendChild(card);
  });
}

// ===================== SECCIÓN: HISTORIAL =====================
var HIST_MES_NOMBRES = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function histPeriodLabel(period) {
  if (period === "semana")   return "Últimos 7 días";
  if (period === "15" || period === "30") return "Últimos " + period + " días";
  if (period === "mes")      { var m = mesOperativo(); return HIST_MES_NOMBRES[parseInt(m.slice(5,7))] + " " + m.slice(0,4); }
  if (period === "anterior") { var m = mesAnterior();  return HIST_MES_NOMBRES[parseInt(m.slice(5,7))] + " " + m.slice(0,4); }
  if (period === "custom" && historialMesViendo) {
    var m = historialMesViendo; return HIST_MES_NOMBRES[parseInt(m.slice(5,7))] + " " + m.slice(0,4);
  }
  if (period === "personalizado") return "Período personalizado";
  return "Período";
}

function histGetFechas(period) {
  if (period === "semana")   return ultimosDias(7);
  if (period === "15" || period === "30") return ultimosDias(parseInt(period, 10));
  if (period === "mes")      return diasDeMes(mesOperativo());
  if (period === "anterior") return diasDeMes(mesAnterior());
  if (period === "custom")   return diasDeMes(historialMesViendo || mesAnterior());
  if (period === "personalizado") return fechasDePeriodo("custom", document.getElementById("hist-desde").value, document.getElementById("hist-hasta").value);
  return ultimosDias(7);
}

function renderHistorial(period) {
  periodHist = period;
  var fechas = histGetFechas(period);
  var filtroSuc = document.getElementById("hist-sucursal").value;
  var sucursales = filtroSuc ? [filtroSuc] : SUCURSALES;
  var label  = histPeriodLabel(period);

  var subtitleEl = document.getElementById("hist-chart-subtitle");
  if (subtitleEl) subtitleEl.textContent = "Ingresos diarios — " + label;

  var acumTitle = document.getElementById("hist-acumulado-title");
  if (acumTitle) acumTitle.textContent = "Acumulado — " + label;

  var tooltipBase = { backgroundColor: "#1a1a1a", borderColor: "#2a2a2a", borderWidth: 1, titleColor: "#f0f0f0", bodyColor: "#666" };
  var chartMobile = window.innerWidth < 768;
  var scalesBase  = {
    x: { ticks: { color: "#555", autoSkip: true, maxTicksLimit: chartMobile ? 6 : 12, maxRotation: 0, font: { size: chartMobile ? 8 : 10 } }, grid: { color: "#1f1f1f" } },
    y: { ticks: { color: "#555", maxTicksLimit: chartMobile ? 5 : 8, font: { size: chartMobile ? 8 : 10 }, callback: function(v) { return fmtM(v); } }, grid: { color: "#1f1f1f" } }
  };

  var datasets = sucursales.map(function(suc) {
    return {
      label: suc,
      data:  fechas.map(function(f) { return sumField(f, suc, "totalIngresos"); }),
      borderColor: COLORS[suc], backgroundColor: COLORS[suc] + "22",
      borderWidth: 2, pointRadius: 2.5, pointBackgroundColor: COLORS[suc],
      fill: false, tension: 0.3
    };
  });

  if (charts.hist) charts.hist.destroy();
  charts.hist = new Chart(document.getElementById("chart-hist"), {
    type: "line",
    data: { labels: fechas.map(function(d) { return d.slice(5); }), datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: chartLegendPosition("top"), labels: { color: "#888", font: { size: chartMobile ? 8 : 10, family: "Space Grotesk" }, boxWidth: 8, padding: 8, usePointStyle: true } }, tooltip: tooltipBase },
      scales: scalesBase
    }
  });

  // Acumulado table — uses the same period (not hardcoded current month)
  var totalesEl  = document.getElementById("hist-totales-mes");
  var totGlobal  = 0;
  var totPorSuc  = sucursales.map(function(suc) {
    var t = fechas.reduce(function(a, f) { return a + sumField(f, suc, "totalIngresos"); }, 0);
    totGlobal += t;
    return t;
  });

  var thRow = '<tr>';
  sucursales.forEach(function(suc) { thRow += '<th style="color:' + COLORS[suc] + '">' + suc + '</th>'; });
  thRow += '<th>TOTAL</th></tr>';

  var tdRow = '<tr>';
  totPorSuc.forEach(function(t) { tdRow += '<td class="td-ing">' + (t ? fmtM(t) : '—') + '</td>'; });
  tdRow += '<td class="td-ing" style="font-weight:700">' + fmtM(totGlobal) + '</td></tr>';

  var tblMes = document.createElement("table");
  tblMes.innerHTML = '<thead>' + thRow + '</thead><tbody>' + tdRow + '</tbody>';
  totalesEl.innerHTML = "";
  totalesEl.appendChild(tblMes);

  // Summary strip
  var resumenWrap = document.getElementById("hist-resumen-wrap");
  var resumenEl   = document.getElementById("hist-resumen");
  if (resumenWrap && resumenEl) {
    var totEg   = 0;
    var diasCon = 0;
    fechas.forEach(function(f) {
      var teneDatos = false;
      sucursales.forEach(function(suc) {
        totEg += sumField(f, suc, "totalEgresos");
        if (sumField(f, suc, "totalIngresos") > 0) teneDatos = true;
      });
      if (teneDatos) diasCon++;
    });
    var neto   = totGlobal - totEg;
    var promDia = diasCon > 0 ? Math.round(totGlobal / diasCon) : 0;
    resumenWrap.style.display = "";
    resumenEl.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:6px">' +
        '<div class="global-card"><div class="gc-label">Ingresos totales</div><div class="gc-val green">' + fmtFull(totGlobal) + '</div></div>' +
        '<div class="global-card"><div class="gc-label">Egresos totales</div><div class="gc-val red">'   + fmtFull(totEg)    + '</div></div>' +
        '<div class="global-card"><div class="gc-label">Neto período</div><div class="gc-val" style="color:' + (neto >= 0 ? 'var(--green)' : 'var(--red)') + '">' + fmtFull(neto) + '</div></div>' +
        '<div class="global-card"><div class="gc-label">Prom. diario</div><div class="gc-val">' + fmtM(promDia) + '</div></div>' +
      '</div>';
  }

  // Day-by-day table
  var tabla = document.getElementById("hist-tabla");
  tabla.innerHTML = "";
  if (!fechas.length) { tabla.innerHTML = '<div class="empty-st">Sin datos para este período.</div>'; return; }

  var tbl   = document.createElement("table");
  var thead = '<thead><tr><th>Fecha</th>';
  sucursales.forEach(function(s) { thead += '<th style="color:' + COLORS[s] + '">' + s + '</th>'; });
  thead += '<th>TOTAL</th></tr></thead>';

  var tbody = '<tbody>';
  fechas.forEach(function(f) {
    var rowTotal = 0;
    var row = '<tr><td style="white-space:nowrap">' + fechaDDMMAAAA(f) + '</td>';
    sucursales.forEach(function(suc) {
      var v = sumField(f, suc, "totalIngresos");
      rowTotal += v;
      row += '<td class="td-ing">' + (v ? fmtM(v) : "—") + '</td>';
    });
    row += '<td class="td-ing" style="font-weight:700">' + (rowTotal ? fmtM(rowTotal) : "—") + '</td></tr>';
    tbody += row;
  });
  tbody += '</tbody>';
  tbl.innerHTML = thead + tbody;
  tabla.appendChild(tbl);
}

function actualizarLabelHistMes() {
  var mes    = historialMesViendo || mesAnterior();
  var label  = document.getElementById("hist-mes-label");
  var nextBtn = document.getElementById("hist-mes-next");
  if (label)  label.textContent = HIST_MES_NOMBRES[parseInt(mes.slice(5,7))] + " " + mes.slice(0,4);
  if (nextBtn) nextBtn.disabled  = sumarMes(mes, 1) > mesActual();
}

function initToggleHist() {
  if (!historialMesViendo) historialMesViendo = mesAnterior();

  document.getElementById("toggle-hist").addEventListener("click", function(e) {
    var btn = e.target.closest(".toggle-btn");
    if (!btn) return;
    document.querySelectorAll("#toggle-hist .toggle-btn").forEach(function(b) { b.classList.remove("active"); });
    btn.classList.add("active");
    periodHist = btn.getAttribute("data-val");
    var mesNav = document.getElementById("hist-mes-nav");
    var customRange = document.getElementById("hist-custom-range");
    if (mesNav) mesNav.style.display = periodHist === "custom" ? "flex" : "none";
    if (customRange) customRange.classList.toggle("hidden", periodHist !== "personalizado");
    if (periodHist === "custom") actualizarLabelHistMes();
    renderHistorial(periodHist);
  });

  ["hist-desde", "hist-hasta"].forEach(function(id) {
    document.getElementById(id).addEventListener("change", function() {
      if (periodHist === "personalizado") renderHistorial(periodHist);
    });
  });
  document.getElementById("hist-sucursal").addEventListener("change", function() { renderHistorial(periodHist); });

  var prevBtn = document.getElementById("hist-mes-prev");
  var nextBtn = document.getElementById("hist-mes-next");
  if (prevBtn) prevBtn.addEventListener("click", function() {
    historialMesViendo = sumarMes(historialMesViendo || mesAnterior(), -1);
    actualizarLabelHistMes();
    renderHistorial(periodHist);
  });
  if (nextBtn) nextBtn.addEventListener("click", function() {
    var sig = sumarMes(historialMesViendo || mesAnterior(), 1);
    if (sig <= mesActual()) {
      historialMesViendo = sig;
      actualizarLabelHistMes();
      renderHistorial(periodHist);
    }
  });
}

// ===================== SECCIÓN: SEMANAL =====================
function semanasDelMesActual() {
  var hoy    = new Date();
  var anio   = hoy.getFullYear();
  var mesN   = hoy.getMonth();
  var primer = new Date(anio, mesN, 1);
  var ultimo = new Date(anio, mesN + 1, 0);
  var semanas = [], sem = 1;
  var d = new Date(primer);

  while (d <= ultimo) {
    var desde = localDateStr(d);
    var fin   = new Date(d);
    fin.setDate(fin.getDate() + (6 - fin.getDay()));
    if (fin > ultimo) fin = new Date(ultimo);
    semanas.push({ label: "SEM " + sem, desde: desde, hasta: localDateStr(fin) });
    sem++;
    d = new Date(fin);
    d.setDate(d.getDate() + 1);
  }
  return semanas;
}

function semanaActual() {
  var hoy     = fechaOperativa();
  var semanas = semanasDelMesActual();
  for (var i = 0; i < semanas.length; i++) {
    if (hoy >= semanas[i].desde && hoy <= semanas[i].hasta) return semanas[i];
  }
  return semanas[semanas.length - 1];
}

function renderSemanal() {
  var compTbody = document.getElementById("semanal-compras-tbody");
  var ventTbody = document.getElementById("semanal-ventas-tbody");
  if (!compTbody || !ventTbody) return;

  var semanas  = semanasDelMesActual();
  var semHoy   = semanaActual();
  var facturas = allFacturas || [];

  // Compras: facturas + egresos proveedores/insumos
  var comprasSems = semanas.map(function(s) {
    var factTotal = facturas
      .filter(function(f) { return f.fecha && f.fecha >= s.desde && f.fecha <= s.hasta; })
      .reduce(function(a, f) { return a + (Number(f.monto) || 0); }, 0);
    var egTotal = 0;
    Object.keys(allData).forEach(function(fecha) {
      if (fecha < s.desde || fecha > s.hasta) return;
      SUCURSALES.forEach(function(suc) {
        getRegs(fecha, suc).forEach(function(r) {
          var eg = (r.tipo === "movimientos" || !r.tipo) ? (r.egresos || {}) : {};
          egTotal += (eg["proveedores"] || 0) + (eg["insumos"] || 0);
        });
      });
    });
    return { label: s.label, desde: s.desde, facturas: factTotal, egresos: egTotal, total: factTotal + egTotal };
  });

  // Ventas: todos los medios de pago
  var ventasSems = semanas.map(function(s) {
    var efectivo = 0, digital = 0;
    Object.keys(allData).forEach(function(fecha) {
      if (fecha < s.desde || fecha > s.hasta) return;
      SUCURSALES.forEach(function(suc) {
        getRegs(fecha, suc).forEach(function(r) {
          var v = (r.tipo === "ventas") ? (r.ventas || {}) : (!r.tipo ? (r.ingresos || {}) : {});
          efectivo += v["efectivo"]      || 0;
          digital  += (v["debito"]        || 0) + (v["credito"]       || 0) +
                      (v["prepaga"]       || 0) + (v["mercadopago"]   || 0) +
                      (v["transferencia"] || 0) + (v["linkpago"]      || 0);
        });
      });
    });
    return { label: s.label, desde: s.desde, efectivo: efectivo, digital: digital, total: efectivo + digital };
  });

  var compSemActual = comprasSems.find(function(s) { return s.desde === semHoy.desde; }) || { total: 0 };
  var ventSemActual = ventasSems.find(function(s)  { return s.desde === semHoy.desde; }) || { total: 0 };
  document.getElementById("semanal-compras-total").textContent = fmtFull(compSemActual.total);
  document.getElementById("semanal-ventas-total").textContent  = fmtFull(ventSemActual.total);

  function renderSemTabla(tbody, sems, cols) {
    tbody.innerHTML = "";
    sems.forEach(function(s) {
      var activo = s.desde === semHoy.desde;
      var tr = document.createElement("tr");
      if (activo) tr.className = "semanal-row-actual";
      tr.innerHTML =
        '<td><span class="semanal-sem-label">' + s.label + '</span>' +
        (activo ? ' <span class="semanal-badge-actual">actual</span>' : '') + '</td>' +
        cols.map(function(k) {
          return '<td class="semanal-td-num">' + (s[k] ? fmtM(s[k]) : '—') + '</td>';
        }).join("") +
        '<td class="semanal-td-tot">' + (s.total ? fmtM(s.total) : '—') + '</td>';
      tbody.appendChild(tr);
    });
  }

  renderSemTabla(compTbody, comprasSems, ["facturas", "egresos"]);
  renderSemTabla(ventTbody, ventasSems,  ["efectivo", "digital"]);
}

function initSemanal() {
  document.querySelectorAll(".semanal-ver-mas").forEach(function(btn) {
    btn.addEventListener("click", function() { goToSection(btn.getAttribute("data-goto")); });
  });
}

// ===================== CIERRE DE CAJA =====================

// Para una sucursal: último cierre registrado (cualquier fecha) + todos los
// movimientos de efectivo registrados DESPUÉS de ese cierre.
// Si no hay cierre: suma todos los movimientos históricos.
function calcEfectivoAcumulado(suc, cierresSnap) {
  // 1. Buscar último cierre de esta sucursal
  var ultimoContado = null;
  var ultimaFecha   = "";

  if (cierresSnap && cierresSnap.exists()) {
    cierresSnap.forEach(function(daySnap) {
      var sucSnap = daySnap.child(suc);
      if (sucSnap.exists() && sucSnap.val().contado != null) {
        if (daySnap.key > ultimaFecha) {
          ultimaFecha   = daySnap.key;
          ultimoContado = sucSnap.val().contado;
        }
      }
    });
  }

  // 2. Sumar movimientos de efectivo posteriores al último cierre (o todos si no hay cierre)
  var movsPosterior = 0;
  Object.keys(allData).sort().forEach(function(fecha) {
    if (ultimaFecha && fecha <= ultimaFecha) return; // solo días posteriores al cierre
    var regs = allData[fecha][suc] || [];
    regs.forEach(function(r) {
      if (r.esEspejoInter) return;
      if (r.tipo === "ventas") {
        movsPosterior += (r.ventas && r.ventas.efectivo) ? r.ventas.efectivo : 0;
      } else if (r.tipo === "movimientos") {
        movsPosterior += r.totalIngInter || 0;
        movsPosterior -= r.totalEgresos  || 0;
      }
    });
  });

  return (ultimoContado !== null ? ultimoContado : 0) + movsPosterior;
}

// Recibe el snapshot completo de cierres para calcular el total acumulado
function renderCierreStrip(cierresSnap) {
  var cont     = document.getElementById("cierre-strip-home");
  var totalVal = document.getElementById("cierre-total-val");
  if (!cont) return;

  var fechaHoy  = fechaOperativa();
  var cierreHoy = (cierresSnap && cierresSnap.exists()) ? cierresSnap.child(fechaHoy) : null;

  cont.innerHTML = "";
  var totalEfectivo = 0;

  SUCURSALES.forEach(function(suc) {
    // Efectivo acumulado real de la sucursal (sin reinicio)
    var efvoAcum = calcEfectivoAcumulado(suc, cierresSnap);
    totalEfectivo += efvoAcum;

    var card = document.createElement("div");
    card.className = "cierre-dash-card";
    var c = COLORS[suc];

    if (cierreHoy && cierreHoy.exists() && cierreHoy.child(suc).exists()) {
      // Sucursal cerrada hoy: mostrar datos del cierre
      var d        = cierreHoy.child(suc).val();
      var difSign  = d.diferencia >= 0 ? "+" : "−";
      var difColor = d.diferencia >= 0 ? "var(--green)" : "var(--red)";
      var hora     = new Date(d.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
      card.classList.add("cierre-ok");
      card.innerHTML =
        '<div class="cs-suc" style="color:' + c + '">' + suc + '</div>' +
        '<div class="cs-estado cs-cerrado">✓ Cerrado ' + hora + '</div>' +
        '<div class="cs-row"><span class="cs-lbl">Contado</span><span class="cs-val cs-contado-verde">' + fmtM(d.contado) + '</span></div>' +
        '<div class="cs-row"><span class="cs-lbl">Sistema</span><span class="cs-val">' + fmtM(d.saldoSistema) + '</span></div>' +
        '<div class="cs-row"><span class="cs-lbl">Diferencia</span><span class="cs-val" style="color:' + difColor + '">' + difSign + fmtM(Math.abs(d.diferencia)) + '</span></div>' +
        (d.nota ? '<div class="cs-nota">' + esc(d.nota) + '</div>' : '');
    } else {
      // Sin cierre hoy: mostrar saldo acumulado en tiempo real
      var efvoColor = efvoAcum >= 0 ? "var(--green)" : "var(--red)";
      card.classList.add("cierre-pendiente");
      card.innerHTML =
        '<div class="cs-suc" style="color:' + c + '">' + suc + '</div>' +
        '<div class="cs-estado cs-pendiente">⏳ Sin cerrar hoy</div>' +
        '<div class="cs-row"><span class="cs-lbl">Efectivo</span><span class="cs-val" style="color:' + efvoColor + '">' + fmtM(efvoAcum) + '</span></div>';
    }
    cont.appendChild(card);
  });

  if (totalVal) {
    totalVal.textContent = fmtFull(totalEfectivo);
    totalVal.style.color = totalEfectivo >= 0 ? "var(--green)" : "var(--red)";
  }
}

// ===================== SECCIÓN: DEUDAS =====================
function guardarDeuda() {
  var cat   = document.getElementById("deuda-categoria").value;
  var sucursal = document.getElementById("deuda-sucursal").value;
  var desc  = document.getElementById("deuda-descripcion").value.trim();
  var monto = parseFloat(document.getElementById("deuda-monto").value) || 0;

  if (!cat)   { alert("Seleccioná una categoría."); return; }
  if (!monto) { alert("Ingresá el monto."); return; }

  var btn = document.getElementById("btn-guardar-deuda");
  btn.disabled    = true;
  btn.textContent = "Verificando...";

  pedirClaveAdmin().then(function(ok) {
    if (!ok) {
      alert("Clave incorrecta.");
      btn.disabled    = false;
      btn.textContent = "+ Registrar Deuda";
      return;
    }
    btn.textContent = "Guardando...";
    firebase.database().ref("deudas").push({
      categoria: cat, sucursal: sucursal, descripcion: desc,
      montoOriginal: monto, montoActual: monto,
      fecha: today(), timestamp: Date.now(), pagos: []
    })
    .then(function() {
      document.getElementById("deuda-categoria").value   = "";
      document.getElementById("deuda-descripcion").value = "";
      document.getElementById("deuda-monto").value       = "";
    })
    .catch(function(e) { alert("Error al guardar: " + e.message); })
    .finally(function() { btn.disabled = false; btn.textContent = "+ Registrar Deuda"; });
  });
}

function abonarDeuda(id, montoActual) {
  var overlay    = document.getElementById("abono-modal");
  var infoEl     = document.getElementById("abono-modal-info");
  var montoInput = document.getElementById("abono-modal-monto");
  var checkTotal = document.getElementById("abono-pago-total");
  var montoWrap  = document.getElementById("abono-monto-wrap");
  var btn        = document.getElementById("abono-modal-btn");
  var cancelBtn  = document.getElementById("abono-modal-cancel");
  var errEl      = document.getElementById("abono-modal-error");

  montoInput.value    = "";
  checkTotal.checked  = false;
  montoInput.disabled = false;
  montoWrap.style.display  = "block";
  montoWrap.style.opacity  = "1";
  btn.disabled    = false;
  btn.textContent = "Confirmar abono";
  errEl.classList.add("hidden");
  infoEl.textContent = "Deuda actual: " + fmtFull(montoActual);

  overlay.classList.remove("hidden");
  setTimeout(function() { montoInput.focus(); }, 80);

  function onCheckTotal() {
    if (checkTotal.checked) {
      montoInput.value    = montoActual;
      montoInput.disabled = true;
      montoWrap.style.opacity = ".5";
    } else {
      montoInput.value    = "";
      montoInput.disabled = false;
      montoWrap.style.opacity = "1";
    }
  }
  checkTotal.addEventListener("change", onCheckTotal);

  function cerrar() {
    overlay.classList.add("hidden");
    btn.removeEventListener("click", confirmar);
    cancelBtn.removeEventListener("click", cerrar);
    montoInput.removeEventListener("keyup", onKey);
    checkTotal.removeEventListener("change", onCheckTotal);
  }

  function confirmar() {
    var abono = parseFloat(montoInput.value);
    if (!abono || abono <= 0 || abono > montoActual) {
      errEl.textContent = abono > montoActual ? "El monto supera la deuda actual." : "Ingresá un monto válido.";
      errEl.classList.remove("hidden");
      return;
    }
    btn.disabled    = true;
    btn.textContent = "Guardando...";
    errEl.classList.add("hidden");

    var nuevoMonto = Math.max(montoActual - abono, 0);
    var ref = firebase.database().ref("deudas/" + id);

    ref.once("value").then(function(snap) {
      if (!snap.exists()) { cerrar(); return; }
      var d     = snap.val();
      var pagos = Array.isArray(d.pagos) ? d.pagos.slice() : [];
      pagos.push({ monto: abono, fecha: today(), timestamp: Date.now() });

      if (nuevoMonto === 0) {
        firebase.database().ref("deudas_historial").push(
          Object.assign({}, d, { montoActual: 0, pagos: pagos, saldadaEl: today(), saldadaTs: Date.now() })
        ).then(function() { ref.remove(); });
      } else {
        ref.update({ montoActual: nuevoMonto, pagos: pagos });
      }
      cerrar();
    }).catch(function() {
      errEl.textContent = "Error al guardar. Intentá de nuevo.";
      errEl.classList.remove("hidden");
      btn.disabled    = false;
      btn.textContent = "Confirmar abono";
    });
  }

  function onKey(e) { if (e.key === "Enter") confirmar(); }
  btn.addEventListener("click", confirmar);
  cancelBtn.addEventListener("click", cerrar);
  montoInput.addEventListener("keyup", onKey);
}

function eliminarDeuda(id) {
  pedirClaveAdmin().then(function(ok) {
    if (!ok) { alert("Clave incorrecta."); return; }
    if (!confirm("¿Eliminar esta deuda?")) return;
    firebase.database().ref("deudas/" + id).remove();
  });
}

function renderDeudas() {
  var strip = document.getElementById("deuda-resumen-strip");
  var lista = document.getElementById("deuda-lista");
  if (!strip || !lista) return;

  var pagoCat = document.getElementById("deuda-pago-categoria");
  var pagoDeuda = document.getElementById("deuda-pago-id");
  if (pagoCat && pagoDeuda) {
    var selectedId = pagoDeuda.value;
    var elegibles = allDeudas.filter(function(d) { return d.categoria === pagoCat.value && (d.montoActual || 0) > 0; });
    pagoDeuda.innerHTML = '<option value="">Seleccioná una deuda</option>' + elegibles.map(function(d) {
      return '<option value="' + d._id + '">' + esc(d.descripcion || CATS_DEUDA[d.categoria]) + ' · ' + fmtFull(d.montoActual) + '</option>';
    }).join("");
    if (elegibles.some(function(d) { return d._id === selectedId; })) pagoDeuda.value = selectedId;
  }

  var periodo = document.getElementById("deuda-filtro-periodo").value;
  var sucursalFiltro = document.getElementById("deuda-filtro-sucursal").value;
  var fechasFiltro = periodo === "todo" ? null : fechasDePeriodo(periodo, document.getElementById("deuda-desde").value, document.getElementById("deuda-hasta").value);
  var deudaFiltrada = allDeudas.filter(function(deuda) {
    var sucursalDeuda = deuda.sucursal || "global";
    if (sucursalFiltro && sucursalDeuda !== sucursalFiltro) return false;
    if (fechasFiltro && fechasFiltro.indexOf(deuda.fecha) === -1) return false;
    return true;
  });

  var porCat = {};
  Object.keys(CATS_DEUDA).forEach(function(k) { porCat[k] = 0; });
  deudaFiltrada.forEach(function(d) {
    var key = porCat[d.categoria] !== undefined ? d.categoria : "proveedores";
    porCat[key] += d.montoActual || 0;
  });
  var totalDeuda = Object.keys(porCat).reduce(function(a, k) { return a + porCat[k]; }, 0);
  if (window.Chart) {
    if (charts.deudas) charts.deudas.destroy();
    charts.deudas = new Chart(document.getElementById("chart-deudas-categorias"), {
      type: "bar",
      data: { labels: Object.keys(CATS_DEUDA).map(function(key) { return CATS_DEUDA[key]; }), datasets: [{ data: Object.keys(CATS_DEUDA).map(function(key) { return porCat[key]; }), backgroundColor: "#ff6b6bbb", borderRadius: 4 }] },
      options: { indexAxis: "y", responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(ctx) { return fmtFull(ctx.raw); } } } }, scales: { x: { ticks: { color: "#888", callback: function(value) { return fmtM(value); } }, grid: { color: "#26313c" } }, y: { ticks: { color: "#aaa" }, grid: { display: false } } } }
    });
  }

  strip.innerHTML =
    '<div class="deuda-strip-total">' +
      '<div class="ds-label">Total adeudado</div>' +
      '<div class="ds-val">' + fmtFull(totalDeuda) + '</div>' +
    '</div>';

  lista.innerHTML = "";
  Object.keys(CATS_DEUDA).forEach(function(cat) {
    var deudas_cat = deudaFiltrada
      .filter(function(d) { return d.categoria === cat; })
      .sort(function(a, b) { return b.timestamp - a.timestamp; });
    var totalCat = porCat[cat] || 0;

    var card = document.createElement("div");
    card.className = "deuda-cat-card " + (totalCat > 0 ? "deuda-cat-activa" : "deuda-cat-vacia");

    var itemsHtml = "";
    deudas_cat.forEach(function(d) {
      // CORRECCIÓN: multiplicar por 100, no por 10
      var pct      = d.montoOriginal > 0 ? Math.round((1 - d.montoActual / d.montoOriginal) * 100) : 0;
      var barColor = pct >= 75 ? "var(--green)" : pct >= 40 ? "#f0a500" : "var(--red)";
      var pagosHtml = "";
      if (d.pagos && d.pagos.length) {
        pagosHtml = '<div class="deuda-pagos">' +
          d.pagos.map(function(p) {
            return '<span class="deuda-pago-chip">−' + fmtM(p.monto) + ' · ' + fechaDDMMAAAA(p.fecha) + (p.detalle ? ' · ' + esc(p.detalle) : '') + '</span>';
          }).join("") +
        '</div>';
      }
      itemsHtml +=
        '<div class="deuda-item">' +
          '<div class="deuda-item-top">' +
            '<div class="deuda-item-left">' +
              (d.descripcion ? '<div class="deuda-desc">' + esc(d.descripcion) + '</div>' : '') +
              '<div class="deuda-fecha">Registrada: ' + fechaDDMMAAAA(d.fecha) + '</div>' +
            '</div>' +
            '<div class="deuda-item-right">' +
              '<div class="deuda-monto-orig">Original: ' + fmtFull(d.montoOriginal) + '</div>' +
              '<div class="deuda-monto-actual">' + fmtFull(d.montoActual) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="deuda-bar-bg"><div class="deuda-bar-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div>' +
          '<div class="deuda-bar-label">' + pct + '% abonado</div>' +
          pagosHtml +
          '<div class="deuda-actions">' +
            '<button class="deuda-btn-del" data-id="' + d._id + '">✕</button>' +
          '</div>' +
        '</div>';
    });

    card.innerHTML =
      '<div class="deuda-cat-header">' +
        '<div class="deuda-cat-nombre">' + CATS_DEUDA[cat] + '</div>' +
        '<div class="deuda-cat-total ' + (totalCat > 0 ? "deuda-total-rojo" : "deuda-total-cero") + '">' + fmtFull(totalCat) + '</div>' +
      '</div>' +
      (itemsHtml ? '<div class="deuda-items-wrap">' + itemsHtml + '</div>' : '');
    lista.appendChild(card);
  });

  lista.querySelectorAll(".deuda-btn-del").forEach(function(btn) {
    btn.addEventListener("click", function() { eliminarDeuda(btn.getAttribute("data-id")); });
  });
}

function fechaDDMMAAAA(fecha) {
  if (!fecha) return "—";
  var partes = String(fecha).slice(0, 10).split("-");
  return partes.length === 3 ? partes[2] + "/" + partes[1] + "/" + partes[0] : fecha;
}

function registrarPagoDeuda() {
  var categoria = document.getElementById("deuda-pago-categoria").value;
  var deudaId = document.getElementById("deuda-pago-id").value;
  var monto = parseFloat(document.getElementById("deuda-pago-monto").value) || 0;
  var fecha = document.getElementById("deuda-pago-fecha").value;
  var detalle = document.getElementById("deuda-pago-detalle").value.trim();
  var error = document.getElementById("deuda-pago-error");
  var button = document.getElementById("btn-registrar-pago");
  var deuda = allDeudas.find(function(item) { return item._id === deudaId && item.categoria === categoria; });

  if (!deuda || !fecha || monto <= 0) {
    error.textContent = "Seleccioná categoría y deuda, indicá fecha y un monto válido.";
    error.classList.remove("hidden");
    return;
  }
  if (monto > deuda.montoActual) {
    error.textContent = "El pago supera el saldo actual de la deuda.";
    error.classList.remove("hidden");
    return;
  }

  error.classList.add("hidden");
  button.disabled = true;
  button.textContent = "Registrando...";
  var ref = firebase.database().ref("deudas/" + deudaId);
  ref.transaction(function(current) {
    if (!current || monto > (current.montoActual || 0)) return;
    var pagos = Array.isArray(current.pagos) ? current.pagos.slice() : [];
    pagos.push({ monto: monto, fecha: fecha, detalle: detalle, timestamp: Date.now() });
    current.pagos = pagos;
    current.montoActual = Math.max((current.montoActual || 0) - monto, 0);
    return current;
  }).then(function(result) {
    if (!result.committed) throw new Error("El saldo cambió; actualizá la selección e intentá otra vez.");
    var actualizado = result.snapshot.val();
    if (actualizado.montoActual === 0) {
      return firebase.database().ref("deudas_historial").push(
        Object.assign({}, actualizado, { saldadaEl: fecha, saldadaTs: Date.now() })
      ).then(function() { return ref.remove(); });
    }
    return null;
  }).then(function() {
    document.getElementById("deuda-pago-monto").value = "";
    document.getElementById("deuda-pago-detalle").value = "";
  }).catch(function(err) {
    error.textContent = err.message || "No se pudo registrar el pago.";
    error.classList.remove("hidden");
  }).finally(function() {
    button.disabled = false;
    button.textContent = "+ Registrar Pago";
  });
}

// ===================== SECCIÓN: SUELDOS =====================

// Payment cycle: starts on the 23rd of each month.
// If today < 23, we're in last month's cycle; if today >= 23 we're in current month's cycle.
function cicloActual() {
  var d = new Date();
  return d.getDate() < 23 ? sumarMes(mesActual(), -1) : mesActual();
}

function renderSueldos() {
  var cicloActualId = cicloActual();
  var sucursalFiltro = document.getElementById("sueldos-sucursal-filtro").value;
  var busqueda = document.getElementById("sueldos-buscar").value.trim().toLowerCase();
  var scopeEmpleados = allEmpleados.filter(function(emp) { return !sucursalFiltro || emp.sucursal === sucursalFiltro; });
  var empleadosVisibles = scopeEmpleados.filter(function(emp) {
    return !busqueda || [emp.nombre, emp.id, emp.dni, emp.puesto].some(function(value) { return String(value || "").toLowerCase().includes(busqueda); });
  });
  var total = scopeEmpleados.reduce(function(a, e) { return a + (Number(e.sueldoBase) || 0); }, 0);
  var pagado = scopeEmpleados.reduce(function(a, e) { return a + (e.pagadoCiclo === cicloActualId ? Number(e.sueldoBase) || 0 : 0); }, 0);
  var baseEl = document.getElementById("sueldos-base-val");
  var paidEl = document.getElementById("sueldos-pagado-val");
  var pendingEl = document.getElementById("sueldos-total-val");
  if (baseEl) baseEl.textContent = fmtFull(total);
  if (paidEl) paidEl.textContent = fmtFull(pagado);
  if (pendingEl) pendingEl.textContent = fmtFull(total - pagado);

  if (window.Chart) {
    if (charts.sueldos) charts.sueldos.destroy();
    var bases = SUCURSALES.map(function(suc) {
      return allEmpleados.filter(function(emp) { return emp.sucursal === suc; }).reduce(function(sum, emp) { return sum + (Number(emp.sueldoBase) || 0); }, 0);
    });
    var pagos = SUCURSALES.map(function(suc) {
      return allEmpleados.filter(function(emp) { return emp.sucursal === suc && emp.pagadoCiclo === cicloActualId; }).reduce(function(sum, emp) { return sum + (Number(emp.sueldoBase) || 0); }, 0);
    });
    charts.sueldos = new Chart(document.getElementById("chart-sueldos-sucursal"), {
      type: "bar",
      data: { labels: SUCURSALES, datasets: [
        { label: "Pagado", data: pagos, backgroundColor: "#00e676bb", stack: "sueldos" },
        { label: "Pendiente", data: bases.map(function(base, index) { return base - pagos[index]; }), backgroundColor: "#f0a500bb", stack: "sueldos" }
      ] },
      options: { responsive: true, plugins: { legend: { position: chartLegendPosition("top"), labels: { color: "#aaa", font: { size: window.innerWidth < 768 ? 9 : 11 }, boxWidth: 8, padding: 8 } }, tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ": " + fmtFull(ctx.raw); } } } }, scales: { x: { stacked: true, ticks: { color: "#aaa", font: { size: 9 } }, grid: { display: false } }, y: { stacked: true, ticks: { color: "#888", font: { size: 9 }, callback: function(value) { return fmtM(value); } }, grid: { color: "#26313c" } } } }
    });
  }

  var tbody = document.getElementById("emp-tabla-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!empleadosVisibles.length) {
    tbody.innerHTML = "<tr><td colspan='8' class='fact-empty-row'>Sin empleados registrados.</td></tr>";
    return;
  }

  // Update sort icon in headers
  document.querySelectorAll(".emp-th-sort").forEach(function(th) {
    var icon = th.querySelector(".sort-icon");
    if (!icon) return;
    icon.textContent = th.getAttribute("data-col") === sueldosSortCol
      ? (sueldosSortDir === "asc" ? "↑" : "↓")
      : "⇅";
  });

  var NUMERIC = ["sueldoBase", "dni"];
  var sorted  = empleadosVisibles.slice().sort(function(a, b) {
    var va = a[sueldosSortCol] != null ? a[sueldosSortCol] : "";
    var vb = b[sueldosSortCol] != null ? b[sueldosSortCol] : "";
    if (NUMERIC.indexOf(sueldosSortCol) !== -1) {
      va = parseFloat(String(va).replace(/\D/g, "")) || 0;
      vb = parseFloat(String(vb).replace(/\D/g, "")) || 0;
      return sueldosSortDir === "asc" ? va - vb : vb - va;
    }
    var cmp = String(va).localeCompare(String(vb), "es", { sensitivity: "base" });
    return sueldosSortDir === "asc" ? cmp : -cmp;
  });

  var ciclo = cicloActual();
  sorted.forEach(function(emp) {
    var c      = COLORS[emp.sucursal] || "#888";
    var pagado = emp.pagadoCiclo === ciclo;
    var tr     = document.createElement("tr");
    tr.innerHTML =
      "<td class='emp-td-id'>"     + esc(emp.id     || "—") + "</td>" +
      "<td class='emp-td-nombre'>" + esc(emp.nombre  || "—") + "</td>" +
      "<td class='emp-td-dni'>"    + esc(emp.dni     || "—") + "</td>" +
      "<td><span class='fact-suc-badge' style='color:" + c + "'>" + esc(emp.sucursal || "—") + "</span></td>" +
      "<td class='emp-td-puesto'>" + esc(emp.puesto  || "—") + "</td>" +
      "<td class='emp-td-sueldo'>" + fmtFull(emp.sueldoBase || 0) + "</td>" +
      "<td style='text-align:center'>" +
        "<input type='checkbox' class='emp-pagado-check' data-id='" + emp._id + "'" + (pagado ? " checked" : "") +
        " title='Pagado 100% — ciclo " + ciclo + "' style='width:16px;height:16px;cursor:pointer;accent-color:var(--green)'>" +
      "</td>" +
      "<td class='emp-td-acc'>" +
        "<button class='emp-btn-edit' data-id='" + emp._id + "'>✎</button>" +
        "<button class='fact-btn-del' data-id='" + emp._id + "'>✕</button>" +
      "</td>";
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".emp-btn-edit").forEach(function(btn) {
    btn.addEventListener("click", function() { editarEmpleado(btn.getAttribute("data-id")); });
  });
  tbody.querySelectorAll(".fact-btn-del").forEach(function(btn) {
    btn.addEventListener("click", function() { eliminarEmpleado(btn.getAttribute("data-id")); });
  });
  tbody.querySelectorAll(".emp-pagado-check").forEach(function(cb) {
    cb.addEventListener("change", function() {
      var empId = cb.getAttribute("data-id");
      var emp = allEmpleados.find(function(item) { return item._id === empId; });
      if (!emp) return;
      var estadoAnterior = emp.pagadoCiclo;
      emp.pagadoCiclo = cb.checked ? cicloActualId : "";
      renderSueldos();
      firebase.database().ref("empleados/" + empId + "/pagadoCiclo").set(emp.pagadoCiclo).catch(function(err) {
        emp.pagadoCiclo = estadoAnterior;
        renderSueldos();
        alert("No se pudo actualizar el pago: " + err.message);
      });
    });
  });
}

function guardarEmpleado() {
  var id     = document.getElementById("emp-id").value.trim();
  var nombre = document.getElementById("emp-nombre").value.trim();
  var dni    = document.getElementById("emp-dni").value.trim();
  var suc    = document.getElementById("emp-sucursal").value;
  var puesto = document.getElementById("emp-puesto").value.trim();
  var sueldo = parseFloat(document.getElementById("emp-sueldo").value) || 0;

  if (!nombre) { alert("Ingresá el nombre."); return; }
  if (!suc)    { alert("Seleccioná una sucursal."); return; }
  if (!puesto) { alert("Ingresá el puesto."); return; }
  if (!sueldo) { alert("Ingresá el sueldo base."); return; }

  var btn = document.getElementById("btn-guardar-empleado");
  btn.disabled    = true;
  btn.textContent = "Verificando...";

  pedirClaveAdmin().then(function(ok) {
    if (!ok) {
      btn.disabled    = false;
      btn.textContent = "+ Agregar empleado";
      return;
    }
    btn.textContent = "Guardando...";
    firebase.database().ref("empleados").push({
      id: id, nombre: nombre, dni: dni, sucursal: suc,
      puesto: puesto, sueldoBase: sueldo, timestamp: Date.now()
    })
    .then(function() {
      document.getElementById("emp-id").value      = "";
      document.getElementById("emp-nombre").value  = "";
      document.getElementById("emp-dni").value     = "";
      document.getElementById("emp-sucursal").value = "";
      document.getElementById("emp-puesto").value  = "";
      document.getElementById("emp-sueldo").value  = "";
    })
    .catch(function(e) { alert("Error al guardar: " + e.message); })
    .finally(function() { btn.disabled = false; btn.textContent = "+ Agregar empleado"; });
  });
}

function editarEmpleado(id) {
  var emp = allEmpleados.find(function(e) { return e._id === id; });
  if (!emp) return;

  var overlay   = document.getElementById("emp-edit-modal");
  var saveBtn   = document.getElementById("emp-edit-save-btn");
  var cancelBtn = document.getElementById("emp-edit-cancel-btn");
  var errEl     = document.getElementById("emp-edit-error");

  document.getElementById("emp-edit-id").value     = emp.id      || "";
  document.getElementById("emp-edit-nombre").value = emp.nombre  || "";
  document.getElementById("emp-edit-dni").value    = emp.dni     || "";
  document.getElementById("emp-edit-suc").value    = emp.sucursal || "";
  document.getElementById("emp-edit-puesto").value = emp.puesto  || "";
  document.getElementById("emp-edit-sueldo").value = emp.sueldoBase || "";

  errEl.classList.add("hidden");
  saveBtn.disabled    = false;
  saveBtn.textContent = "Guardar cambios";
  overlay.classList.remove("hidden");

  function cerrar() {
    overlay.classList.add("hidden");
    saveBtn.removeEventListener("click", guardar);
    cancelBtn.removeEventListener("click", cerrar);
  }

  function guardar() {
    var nombre = document.getElementById("emp-edit-nombre").value.trim();
    var suc    = document.getElementById("emp-edit-suc").value;
    var puesto = document.getElementById("emp-edit-puesto").value.trim();
    var sueldo = parseFloat(document.getElementById("emp-edit-sueldo").value) || 0;

    if (!nombre || !suc || !puesto || !sueldo) {
      errEl.textContent = "Completá todos los campos obligatorios.";
      errEl.classList.remove("hidden");
      return;
    }

    saveBtn.disabled    = true;
    saveBtn.textContent = "Guardando...";

    firebase.database().ref("empleados/" + id).update({
      id:         document.getElementById("emp-edit-id").value.trim(),
      nombre:     nombre,
      dni:        document.getElementById("emp-edit-dni").value.trim(),
      sucursal:   suc,
      puesto:     puesto,
      sueldoBase: sueldo
    })
    .then(function() { cerrar(); })
    .catch(function(e) {
      errEl.textContent = "Error al guardar: " + e.message;
      errEl.classList.remove("hidden");
      saveBtn.disabled    = false;
      saveBtn.textContent = "Guardar cambios";
    });
  }

  saveBtn.addEventListener("click", guardar);
  cancelBtn.addEventListener("click", cerrar);
}

function eliminarEmpleado(id) {
  pedirClaveAdmin().then(function(ok) {
    if (!ok) { alert("Clave incorrecta."); return; }
    if (!confirm("¿Eliminar este empleado?")) return;
    firebase.database().ref("empleados/" + id).remove();
  });
}

function initSueldos() {
  var content = document.getElementById("sueldos-content");

  if (!adminAuthValida()) {
    pedirClaveAdmin().then(function(ok) {
      if (ok) initSueldos();
    });
    return;
  }

  content.style.display = "block";
  document.getElementById("btn-guardar-empleado").onclick = guardarEmpleado;

  // One-time event handler setup
  if (!sueldosInitedOnce) {
    sueldosInitedOnce = true;
    document.getElementById("sueldos-sucursal-filtro").addEventListener("change", renderSueldos);
    document.getElementById("sueldos-buscar").addEventListener("input", renderSueldos);

    // Bidirectional column sort
    document.querySelectorAll(".emp-th-sort").forEach(function(th) {
      th.addEventListener("click", function() {
        var col = th.getAttribute("data-col");
        if (sueldosSortCol === col) {
          sueldosSortDir = sueldosSortDir === "asc" ? "desc" : "asc";
        } else {
          sueldosSortCol = col;
          sueldosSortDir = "asc";
        }
        renderSueldos();
      });
    });

    // Collapsible new-employee form
    var toggleBtn = document.getElementById("btn-toggle-emp-form");
    var formWrap  = document.getElementById("emp-form-wrap");
    if (toggleBtn && formWrap) {
      toggleBtn.addEventListener("click", function() {
        var open = formWrap.style.display !== "none";
        formWrap.style.display = open ? "none" : "block";
        toggleBtn.textContent  = open ? "+ Nuevo empleado" : "− Cerrar formulario";
      });
    }
  }

  if (sueldosRef) return; // Firebase listener ya activo — no duplicar
  sueldosRef = firebase.database().ref("empleados");
  sueldosRef.on("value", function(snap) {
    allEmpleados = [];
    if (snap.exists()) {
      snap.forEach(function(child) {
        allEmpleados.push(Object.assign({ _id: child.key }, child.val()));
      });
    }
    renderSueldos();
  });
}

function initDeudas() {
  document.getElementById("btn-guardar-deuda").addEventListener("click", guardarDeuda);
  document.getElementById("deuda-pago-fecha").value = today();
  document.getElementById("deuda-pago-categoria").addEventListener("change", renderDeudas);
  document.getElementById("btn-registrar-pago").addEventListener("click", registrarPagoDeuda);
  document.getElementById("deuda-filtro-periodo").addEventListener("change", function() {
    var custom = document.getElementById("deuda-filtro-periodo").value === "custom";
    document.getElementById("deuda-custom-range").classList.toggle("hidden", !custom);
    renderDeudas();
  });
  document.getElementById("deuda-filtro-sucursal").addEventListener("change", renderDeudas);
  ["deuda-desde", "deuda-hasta"].forEach(function(id) {
    document.getElementById(id).addEventListener("change", renderDeudas);
  });
  firebase.database().ref("deudas").on("value", function(snap) {
    allDeudas = [];
    if (snap.exists()) {
      snap.forEach(function(child) {
        allDeudas.push(Object.assign({ _id: child.key }, child.val()));
      });
    }
    if (sectionActual === "deudas") renderDeudas();
  });
}

var cierresSnapCache = null; // cache del último snapshot de cierres

// ===================== FIREBASE =====================
function initFirebase() {
  if (!empleadosAnalyticsRef) {
    empleadosAnalyticsRef = firebase.database().ref("empleados");
    empleadosAnalyticsRef.on("value", function(snap) {
      allEmpleados = [];
      if (snap.exists()) snap.forEach(function(child) {
        allEmpleados.push(Object.assign({ _id: child.key }, child.val()));
      });
      if (sectionActual === "objetivos") renderObjetivos();
      if (sectionActual === "sueldos") renderSueldos();
    });
  }
  firebase.database().ref("registros").on("value", function(snap) {
    allData = {};
    if (snap.exists()) {
      snap.forEach(function(daySnap) {
        var fecha = daySnap.key;
        allData[fecha] = {};
        daySnap.forEach(function(sucSnap) {
          allData[fecha][sucSnap.key] = [];
          sucSnap.forEach(function(regSnap) {
            allData[fecha][sucSnap.key].push(regSnap.val());
          });
        });
      });
    }
    renderHome();
    // Recalcular efectivo acumulado con los registros actualizados
    renderCierreStrip(cierresSnapCache);
    if (sectionActual === "objetivos") renderObjetivos();
    if (sectionActual === "egresos")   renderEgresos(periodEgresos);
    if (sectionActual === "merma")     renderMerma();
    if (sectionActual === "historial") renderHistorial(periodHist);
  });

  // Listener de cierres — pasa el snapshot completo para calcular efectivo acumulado
  firebase.database().ref("cierres").on("value", function(cierresSnap) {
    cierresSnapCache = cierresSnap;
    renderCierreStrip(cierresSnap);
    if (sectionActual === "home") renderFeed(); // refresh feed so cierre cards appear
  });

  firebase.database().ref("config/objetivos").on("value", function(snap) {
    todosObjetivos = {};
    if (snap.exists()) {
      snap.forEach(function(mesSnap) {
        todosObjetivos[mesSnap.key] = mesSnap.val();
      });
    }
    if (sectionActual === "objetivos") renderObjetivos();
  });

  firebase.database().ref("facturas").on("value", function(snap) {
    allFacturas = [];
    if (snap.exists()) {
      snap.forEach(function(child) {
        allFacturas.push(Object.assign({ _id: child.key }, child.val()));
      });
    }
    updateProveedoresDatalist();
    var dlNum = document.getElementById("numeros-list");
    if (dlNum) {
      var numeros = [];
      allFacturas.forEach(function(f) {
        if (f.numero && numeros.indexOf(f.numero) === -1) numeros.push(f.numero);
      });
      numeros.sort();
      dlNum.innerHTML = numeros.map(function(n) {
        return '<option value="' + esc(n) + '">';
      }).join("");
    }
    if (sectionActual === "facturas")    renderFacturas();
    if (sectionActual === "proveedores") renderProveedores();
    if (sectionActual === "objetivos")   renderObjetivos();
    renderSemanal();
  });
}

// ===================== SECCIÓN: PROVEEDORES =====================
function normalizarProv(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[.,\-']/g, "")
    .replace(/\b(srl|sa|sac|sacif|sas|srlu|sl|inc|corp|ltda?)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  var m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  var prev = [], curr = [];
  for (var j = 0; j <= n; j++) prev[j] = j;
  for (var i = 1; i <= m; i++) {
    curr[0] = i;
    for (var j = 1; j <= n; j++) {
      curr[j] = a[i-1] === b[j-1] ? prev[j-1]
        : 1 + Math.min(prev[j], curr[j-1], prev[j-1]);
    }
    prev = curr.slice();
  }
  return prev[n];
}

function buildProvLookup() {
  var lookup = {};
  allProveedores.forEach(function(p) {
    if (p.nombre) lookup[p.nombre.toLowerCase()] = p._id;
    (p.variantes || []).forEach(function(v) {
      lookup[v.toLowerCase()] = p._id;
    });
  });
  return lookup;
}

function getUniqueRawNames() {
  var seen = {}, names = [];
  allFacturas.forEach(function(f) {
    if (!f.proveedor) return;
    var key = f.proveedor.toLowerCase();
    if (!seen[key]) { seen[key] = true; names.push(f.proveedor); }
  });
  return names;
}

function getProvStats(variantes, filtros) {
  var varSet = {};
  (variantes || []).forEach(function(v) { varSet[v.toLowerCase()] = true; });
  var count = 0, total = 0;
  allFacturas.forEach(function(f) {
    if (filtros && filtros.sucursal && f.sucursal !== filtros.sucursal) return;
    if (filtros && filtros.desde && f.fecha < filtros.desde) return;
    if (filtros && filtros.hasta && f.fecha > filtros.hasta) return;
    if (f.proveedor && varSet[f.proveedor.toLowerCase()]) {
      count++; total += (f.monto || 0);
    }
  });
  return { count: count, total: total };
}

function getCountForRaw(rawName) {
  var key = rawName.toLowerCase();
  return allFacturas.filter(function(f) {
    return f.proveedor && f.proveedor.toLowerCase() === key;
  }).length;
}

function findSugerencias(unmatched) {
  var normed = unmatched.map(normalizarProv);
  var pairs = [], used = {};
  for (var i = 0; i < unmatched.length; i++) {
    if (used[i] || !normed[i] || normed[i].length < 4) continue;
    for (var j = i + 1; j < unmatched.length; j++) {
      if (used[j] || !normed[j] || normed[j].length < 4) continue;
      var d = levenshtein(normed[i], normed[j]);
      if (d <= 2) {
        pairs.push([unmatched[i], unmatched[j]]);
        used[i] = true; used[j] = true;
        break;
      }
    }
  }
  return pairs;
}

function updateProveedoresDatalist() {
  var dl = document.getElementById("proveedores-list");
  if (!dl) return;
  var nombres = {};
  allProveedores.forEach(function(p) { if (p.nombre) nombres[p.nombre] = true; });
  var lookup = buildProvLookup();
  allFacturas.forEach(function(f) {
    if (f.proveedor && !lookup[f.proveedor.toLowerCase()]) nombres[f.proveedor] = true;
  });
  var sorted = Object.keys(nombres).sort();
  dl.innerHTML = sorted.map(function(n) {
    return '<option value="' + esc(n) + '">';
  }).join("");
}

function renderProveedores() {
  if (sectionActual !== "proveedores") return;

  var buscar  = (document.getElementById("prov-buscar").value || "").toLowerCase().trim();
  var montoMin = parseFloat(document.getElementById("prov-monto-min").value) || 0;
  var montoMaxRaw = document.getElementById("prov-monto-max").value;
  var montoMax = montoMaxRaw === "" ? Infinity : parseFloat(montoMaxRaw);
  var estado = document.getElementById("prov-estado").value;
  var etiqueta = document.getElementById("prov-etiqueta").value.toLowerCase().trim();
  var filtrosFactura = {
    sucursal: document.getElementById("prov-sucursal").value,
    desde: document.getElementById("prov-desde").value,
    hasta: document.getElementById("prov-hasta").value
  };
  var lookup  = buildProvLookup();
  var rawAll  = getUniqueRawNames();
  var statsAll = allProveedores.map(function(p) { return { proveedor: p, stats: getProvStats((p.variantes || []).concat(p.nombre || []), filtrosFactura) }; });
  var facturasScope = allFacturas.filter(function(f) {
    return (!filtrosFactura.sucursal || f.sucursal === filtrosFactura.sucursal) &&
      (!filtrosFactura.desde || f.fecha >= filtrosFactura.desde) &&
      (!filtrosFactura.hasta || f.fecha <= filtrosFactura.hasta);
  });
  var totalHistorico = facturasScope.reduce(function(total, f) { return total + (Number(f.monto) || 0); }, 0);
  var totalConFactura = statsAll.filter(function(item) { return item.stats.count > 0; }).length;
  var topProveedor = statsAll.slice().sort(function(a, b) { return b.stats.total - a.stats.total; })[0];
  if (window.Chart) {
    if (charts.proveedores) charts.proveedores.destroy();
    var topProveedores = statsAll.filter(function(item) { return item.stats.count > 0; }).sort(function(a, b) { return b.stats.total - a.stats.total; }).slice(0, 5);
    charts.proveedores = new Chart(document.getElementById("chart-prov-top"), {
      type: "bar",
      data: { labels: topProveedores.map(function(item) { return esc(item.proveedor.nombre); }), datasets: [{ data: topProveedores.map(function(item) { return item.stats.total; }), backgroundColor: "#00e676bb", borderRadius: 4 }] },
      options: { indexAxis: "y", responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(ctx) { return fmtFull(ctx.raw); } } } }, scales: { x: { ticks: { color: "#888", callback: function(value) { return fmtM(value); } }, grid: { color: "#26313c" } }, y: { ticks: { color: "#aaa" }, grid: { display: false } } } }
    });
  }
  document.getElementById("prov-kpis").innerHTML =
    '<div class="global-card"><div class="gc-label">Monto del período</div><div class="gc-val">' + fmtFull(totalHistorico) + '</div></div>' +
    '<div class="global-card"><div class="gc-label">Facturas del período</div><div class="gc-val">' + facturasScope.length + '</div></div>' +
    '<div class="global-card"><div class="gc-label">Promedio por proveedor</div><div class="gc-val">' + fmtFull(totalConFactura ? totalHistorico / totalConFactura : 0) + '</div></div>' +
    '<div class="global-card"><div class="gc-label">Mayor facturación</div><div class="gc-val">' + (topProveedor ? esc(topProveedor.proveedor.nombre) + ' · ' + fmtM(topProveedor.stats.total) : '—') + '</div></div>';

  var unmatched = rawAll.filter(function(n) { return !lookup[n.toLowerCase()]; });
  var sugerencias = findSugerencias(unmatched);
  var sugeridosSet = {};
  sugerencias.forEach(function(pair) {
    sugeridosSet[pair[0].toLowerCase()] = true;
    sugeridosSet[pair[1].toLowerCase()] = true;
  });
  var sinClasificar = unmatched.filter(function(n) { return !sugeridosSet[n.toLowerCase()]; });

  // --- Sugerencias ---
  var sugWrap  = document.getElementById("prov-sugerencias-wrap");
  var sugLista = document.getElementById("prov-sugerencias-lista");
  if (sugerencias.length) {
    sugWrap.style.display = "";
    sugLista.innerHTML = "";
    sugerencias.forEach(function(pair) {
      var card = document.createElement("div");
      card.className = "prov-sug-card";
      card.innerHTML =
        '<div class="prov-sug-nombres">' +
          '<span class="prov-sug-name">' + esc(pair[0]) + '</span>' +
          '<span class="prov-sug-badge">' + getCountForRaw(pair[0]) + '</span>' +
          '<span class="prov-sug-sep">·</span>' +
          '<span class="prov-sug-name">' + esc(pair[1]) + '</span>' +
          '<span class="prov-sug-badge">' + getCountForRaw(pair[1]) + '</span>' +
        '</div>' +
        '<button class="prov-btn-unif" data-a="' + encodeURIComponent(pair[0]) + '" data-b="' + encodeURIComponent(pair[1]) + '">Unificar</button>';
      sugLista.appendChild(card);
    });
    sugLista.querySelectorAll(".prov-btn-unif").forEach(function(btn) {
      btn.addEventListener("click", function() {
        abrirModalUnificar(
          decodeURIComponent(btn.getAttribute("data-a")),
          decodeURIComponent(btn.getAttribute("data-b"))
        );
      });
    });
  } else {
    sugWrap.style.display = "none";
  }

  // --- Sin clasificar ---
  var nuevosWrap  = document.getElementById("prov-nuevos-wrap");
  var nuevosLista = document.getElementById("prov-nuevos-lista");
  var filtradosSin = buscar
    ? sinClasificar.filter(function(n) { return n.toLowerCase().includes(buscar); })
    : sinClasificar;
  if (filtradosSin.length) {
    nuevosWrap.style.display = "";
    nuevosLista.innerHTML = "";
    filtradosSin.forEach(function(raw) {
      var chip = document.createElement("div");
      chip.className = "prov-nuevo-chip";
      chip.innerHTML =
        '<span class="prov-nuevo-name">' + esc(raw) + '</span>' +
        '<span class="prov-sug-badge">' + getCountForRaw(raw) + ' fact.</span>' +
        '<button class="prov-btn-asig" data-raw="' + encodeURIComponent(raw) + '">Asignar a existente</button>' +
        '<button class="prov-btn-crear" data-raw="' + encodeURIComponent(raw) + '">+ Crear proveedor</button>';
      nuevosLista.appendChild(chip);
    });
    nuevosLista.querySelectorAll(".prov-btn-crear").forEach(function(btn) {
      btn.addEventListener("click", function() {
        crearProveedorDesdeRaw(decodeURIComponent(btn.getAttribute("data-raw")));
      });
    });
    nuevosLista.querySelectorAll(".prov-btn-asig").forEach(function(btn) {
      btn.addEventListener("click", function() {
        abrirModalAsignar(decodeURIComponent(btn.getAttribute("data-raw")));
      });
    });
  } else {
    nuevosWrap.style.display = "none";
  }

  // --- Lista confirmada ---
  var lista = document.getElementById("prov-lista");
  var provFiltrados = allProveedores.filter(function(p) {
    var stats = getProvStats((p.variantes || []).concat(p.nombre || []), filtrosFactura);
    var tags = p.etiquetas || [];
    var matchSearch = !buscar || p.nombre.toLowerCase().includes(buscar) ||
      (p.variantes || []).some(function(v) { return v.toLowerCase().includes(buscar); }) ||
      tags.some(function(tag) { return tag.toLowerCase().includes(buscar); });
    var matchTag = !etiqueta || tags.some(function(tag) { return tag.toLowerCase().includes(etiqueta); });
    var matchStatus = !estado || (estado === "con" ? stats.count > 0 : stats.count === 0);
    return matchSearch && matchTag && matchStatus && stats.total >= montoMin && stats.total <= montoMax;
  });
  provFiltrados.sort(function(a, b) { return a.nombre.localeCompare(b.nombre); });

  if (!provFiltrados.length) {
    lista.innerHTML = '<div class="empty-state">' +
      (allProveedores.length === 0
        ? 'No hay proveedores aún. Clasificá los nombres del historial para armar la base.'
        : 'No hay proveedores que coincidan con la búsqueda.') +
      '</div>';
    return;
  }

  lista.innerHTML = "";
  provFiltrados.forEach(function(p) {
    var stats      = getProvStats((p.variantes || []).concat(p.nombre || []), filtrosFactura);
    var card       = document.createElement("div");
    card.className = "prov-card";
    var variasHtml = (p.variantes || []).map(function(v) {
      return '<span class="prov-var-chip" data-pid="' + p._id + '" data-v="' + encodeURIComponent(v) + '">' +
        esc(v) + ' <button class="prov-var-del" title="Quitar variante">✕</button></span>';
    }).join("");
    card.innerHTML =
      '<div class="prov-card-header">' +
        '<div class="prov-card-nombre">' + esc(p.nombre) + '</div>' +
        '<div class="prov-card-acciones">' +
          '<button class="prov-btn-edit" data-id="' + p._id + '">✎ Renombrar</button>' +
          '<button class="prov-btn-del" data-id="' + p._id + '" title="Eliminar proveedor">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="prov-card-stats">' +
        '<span>' + stats.count + ' factura' + (stats.count !== 1 ? 's' : '') + '</span>' +
        '<span class="prov-stats-sep">·</span>' +
        '<span>' + fmtFull(stats.total) + '</span>' +
      '</div>' +
      '<div class="prov-card-tags">' +
        (p.etiquetas || []).map(function(tag) { return '<span class="prov-tag">' + esc(tag) + '</span>'; }).join("") +
        '<button class="prov-btn-tags" data-id="' + p._id + '">Etiquetas</button>' +
      '</div>' +
      '<div class="prov-card-variantes">' + variasHtml + '</div>';
    lista.appendChild(card);
  });

  lista.querySelectorAll(".prov-btn-edit").forEach(function(btn) {
    btn.addEventListener("click", function() { abrirModalRenombrar(btn.getAttribute("data-id")); });
  });
  lista.querySelectorAll(".prov-btn-tags").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var proveedor = allProveedores.find(function(p) { return p._id === btn.getAttribute("data-id"); });
      if (!proveedor) return;
      var raw = prompt("Etiquetas separadas por coma:", (proveedor.etiquetas || []).join(", "));
      if (raw === null) return;
      var tags = Array.from(new Set(raw.split(",").map(function(tag) { return tag.trim(); }).filter(Boolean)));
      firebase.database().ref("config/proveedores/" + proveedor._id + "/etiquetas").set(tags);
    });
  });
  lista.querySelectorAll(".prov-btn-del").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var p = allProveedores.find(function(x) { return x._id === btn.getAttribute("data-id"); });
      if (!p || !confirm('¿Eliminar "' + p.nombre + '"? Sus variantes quedarán sin clasificar.')) return;
      firebase.database().ref("config/proveedores/" + p._id).remove();
    });
  });
  lista.querySelectorAll(".prov-var-del").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      var chip = btn.closest("[data-pid]");
      var pid  = chip.getAttribute("data-pid");
      var v    = decodeURIComponent(chip.getAttribute("data-v"));
      var p    = allProveedores.find(function(x) { return x._id === pid; });
      if (!p || !confirm('¿Quitar "' + v + '" de las variantes de "' + p.nombre + '"?')) return;
      var nuevas = (p.variantes || []).filter(function(x) { return x !== v; });
      firebase.database().ref("config/proveedores/" + pid + "/variantes").set(nuevas);
    });
  });
}

// ----- Acciones sobre proveedores -----
function abrirProvModal(titulo, html, onOk) {
  var modal  = document.getElementById("prov-modal");
  var titulo_ = document.getElementById("prov-modal-titulo");
  var cuerpo = document.getElementById("prov-modal-cuerpo");
  titulo_.textContent = titulo;
  cuerpo.innerHTML    = html;
  modal.classList.remove("hidden");

  var btnOk  = document.getElementById("prov-modal-ok");
  var btnCan = document.getElementById("prov-modal-cancel");
  var newOk  = btnOk.cloneNode(true);
  var newCan = btnCan.cloneNode(true);
  btnOk.parentNode.replaceChild(newOk, btnOk);
  btnCan.parentNode.replaceChild(newCan, btnCan);

  newCan.addEventListener("click", function() { modal.classList.add("hidden"); });
  newOk.addEventListener("click", function() { if (onOk() !== false) modal.classList.add("hidden"); });
}

function abrirModalUnificar(nameA, nameB) {
  abrirProvModal("Unificar proveedores",
    '<p class="prov-modal-desc">¿Cuál es el nombre canónico para este proveedor?</p>' +
    '<div class="prov-radio-group">' +
      '<label class="prov-radio-row"><input type="radio" name="prov-canon" value="' + esc(nameA) + '" checked> ' + esc(nameA) + '</label>' +
      '<label class="prov-radio-row"><input type="radio" name="prov-canon" value="' + esc(nameB) + '"> ' + esc(nameB) + '</label>' +
      '<label class="prov-radio-row"><input type="radio" name="prov-canon" value="__custom__"> Personalizado: ' +
        '<input type="text" id="prov-canon-custom" placeholder="Escribí el nombre" class="prov-text-inline">' +
      '</label>' +
    '</div>',
    function() {
      var sel = document.querySelector('input[name="prov-canon"]:checked');
      if (!sel) return false;
      var canonical = sel.value === "__custom__"
        ? (document.getElementById("prov-canon-custom").value.trim())
        : sel.value;
      if (!canonical) { alert("Ingresá un nombre para el proveedor."); return false; }
      firebase.database().ref("config/proveedores").push({ nombre: canonical, variantes: [nameA, nameB] });
    }
  );
  var customInput = document.getElementById("prov-canon-custom");
  if (customInput) {
    customInput.addEventListener("click", function() {
      document.querySelector('input[name="prov-canon"][value="__custom__"]').checked = true;
    });
  }
}

function abrirModalAsignar(rawName) {
  var opts = allProveedores
    .slice().sort(function(a, b) { return a.nombre.localeCompare(b.nombre); })
    .map(function(p) { return '<option value="' + p._id + '">' + esc(p.nombre) + '</option>'; }).join("");
  abrirProvModal('Asignar "' + rawName + '"',
    '<p class="prov-modal-desc">Seleccioná a qué proveedor pertenece este nombre:</p>' +
    '<div class="select-wrap-dark"><select id="prov-asig-select">' +
      '<option value="">— Seleccioná proveedor —</option>' + opts +
    '</select></div>',
    function() {
      var sel = document.getElementById("prov-asig-select").value;
      if (!sel) { alert("Seleccioná un proveedor."); return false; }
      var p = allProveedores.find(function(x) { return x._id === sel; });
      if (!p) return false;
      var nuevas = (p.variantes || []).concat([rawName]);
      firebase.database().ref("config/proveedores/" + sel + "/variantes").set(nuevas);
    }
  );
}

function abrirModalRenombrar(provId) {
  var p = allProveedores.find(function(x) { return x._id === provId; });
  if (!p) return;
  abrirProvModal("Renombrar proveedor",
    '<p class="prov-modal-desc">Nuevo nombre canónico:</p>' +
    '<input type="text" id="prov-rename-input" value="' + esc(p.nombre) + '" class="prov-text-full">',
    function() {
      var nuevo = document.getElementById("prov-rename-input").value.trim();
      if (!nuevo) { alert("Ingresá un nombre."); return false; }
      firebase.database().ref("config/proveedores/" + provId + "/nombre").set(nuevo);
    }
  );
  setTimeout(function() {
    var el = document.getElementById("prov-rename-input");
    if (el) { el.focus(); el.select(); }
  }, 100);
}

function crearProveedorDesdeRaw(rawName) {
  firebase.database().ref("config/proveedores").push({ nombre: rawName, variantes: [rawName] });
}

function initProveedores() {
  if (provRef) { provRef.off(); provRef = null; }
  provRef = firebase.database().ref("config/proveedores");
  provRef.on("value", function(snap) {
    allProveedores = [];
    if (snap.exists()) {
      snap.forEach(function(child) {
        allProveedores.push(Object.assign({ _id: child.key }, child.val()));
      });
    }
    updateProveedoresDatalist();
    if (sectionActual === "proveedores") renderProveedores();
    if (sectionActual === "facturas") renderFacturas();
  });

  document.getElementById("prov-buscar").addEventListener("input", renderProveedores);
  ["prov-monto-min", "prov-monto-max", "prov-etiqueta", "prov-desde", "prov-hasta"].forEach(function(id) {
    document.getElementById(id).addEventListener("input", renderProveedores);
  });
  document.getElementById("prov-estado").addEventListener("change", renderProveedores);
  document.getElementById("prov-sucursal").addEventListener("change", renderProveedores);
}

// ===================== INIT =====================
function initApp() {
  document.documentElement.lang = "es-AR";
  document.querySelectorAll('input[type="date"]').forEach(function(input) { input.lang = "es-AR"; });
  document.getElementById("fecha-hoy").textContent = fechaDDMMAAAA(fechaOperativa());

  function tickReloj() {
    document.getElementById("reloj").textContent =
      new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  }
  tickReloj();
  setInterval(tickReloj, 1000);

  initNav();
  initObjetivosModal();
  initFacturas();
  initDeudas();
  initSemanal();
  initToggleParticipacion();
  initToggleEgresos();
  initReportFilter("merma-filtros", "merma", periodMerma, function(period) {
    periodMerma = period;
    renderMerma();
  });
  initToggleHist();
  initToggleHome();
  initFeedFilters();
  initFirebase();
  initProveedores();
}

document.addEventListener("DOMContentLoaded", function() {
  if (window.Chart) {
    Chart.defaults.color       = "#888";
    Chart.defaults.font.family = "Space Grotesk, sans-serif";
    Chart.defaults.font.size   = 11;
  }

  if (!ensureFirebaseReady("dashboard")) return;

  var yaAutenticado = initDashLogin();
  if (yaAutenticado) initApp();
});