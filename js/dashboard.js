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
  { id: "mercadopago",   label: "Mercado Pago / QR" },
  { id: "linkpago",      label: "Link de Pago" },
  { id: "transferencia", label: "Transferencia" }
];
var RUBROS_EG = [
  { id: "proveedores", label: "Proveedores" },
  { id: "insumos",     label: "Insumos" },
  { id: "alquiler",    label: "Alquiler" },
  { id: "servicios",   label: "Servicios" },
  { id: "retiro",      label: "Retiro" },
  { id: "transferencia-inter", label: "Transf. inter-sucursal" },
  { id: "otros",       label: "Otros" }
];

// Objetivos default (se sobreescriben con localStorage)
var OBJETIVOS_DEFAULT = {
  NAZCA: 36000000, OLAZABAL: 29000000, CUENCA: 30000000,
  BEIRO: 23000000, GOYENA: 26000000
};

// ===================== AUTH DASHBOARD =====================
var AUTH_KEY      = "vvglobal_dash_auth"; // localStorage key
var AUTH_DURATION = 8 * 60 * 60 * 1000;  // 8 horas

function dashAuthValida() {
  try {
    var raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return false;
    var data = JSON.parse(raw);
    return (Date.now() - data.ts) < AUTH_DURATION;
  } catch(e) { return false; }
}

function guardarDashAuth() {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ ts: Date.now() }));
}

function initDashLogin() {
  var pantalla = document.getElementById("pantalla-login");
  var input    = document.getElementById("db-login-input");
  var btn      = document.getElementById("db-login-btn");
  var errEl    = document.getElementById("db-login-error");

  // Si ya está autenticado, ocultamos la pantalla y arrancamos
  if (dashAuthValida()) {
    pantalla.classList.add("hidden");
    return true;
  }

  pantalla.classList.remove("hidden");

  function intentarLogin() {
    var clave = input.value.trim();
    if (!clave) return;
    btn.disabled = true;
    btn.textContent = "Verificando...";
    errEl.classList.add("hidden");

    firebase.database().ref("config/claves/dashboard").once("value")
      .then(function(snap) {
        var ok = !snap.exists() || clave === String(snap.val()).trim();
        if (ok) {
          guardarDashAuth();
          pantalla.classList.add("hidden");
          // Arrancar la app
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
        btn.disabled = false;
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

// ===================== CLAVE ADMIN — REEMPLAZA pedirClaveAdmin() =====================
// Pegar esto en dashboard.js reemplazando la función pedirClaveAdmin() existente

var ADMIN_KEY      = "vvglobal_admin_auth";
var ADMIN_DURATION = 60 * 60 * 1000; // 1 hora

function adminAuthValida() {
  try {
    var raw = localStorage.getItem(ADMIN_KEY);
    if (!raw) return false;
    var data = JSON.parse(raw);
    return (Date.now() - data.ts) < ADMIN_DURATION;
  } catch(e) { return false; }
}

function guardarAdminAuth() {
  localStorage.setItem(ADMIN_KEY, JSON.stringify({ ts: Date.now() }));
}

// Reemplaza el prompt() nativo — devuelve Promise<boolean>
function pedirClaveAdmin() {
  // Si ya está autenticado y no expiró, no pedir clave
  if (adminAuthValida()) {
    return Promise.resolve(true);
  }

  return new Promise(function(resolve) {
    var overlay  = document.getElementById("admin-modal");
    var input    = document.getElementById("admin-modal-input");
    var btn      = document.getElementById("admin-modal-btn");
    var cancelBtn= document.getElementById("admin-modal-cancel");
    var errEl    = document.getElementById("admin-modal-error");

    // Limpiar estado anterior
    input.value = "";
    errEl.classList.add("hidden");
    btn.disabled = false;
    btn.textContent = "Confirmar";

    // Mostrar modal
    overlay.classList.remove("hidden");
    setTimeout(function() { input.focus(); }, 80);

    function cerrar(resultado) {
      overlay.classList.add("hidden");
      // Remover listeners para no acumularlos
      btn.removeEventListener("click", intentar);
      cancelBtn.removeEventListener("click", cancelar);
      input.removeEventListener("keyup", onKey);
      resolve(resultado);
    }

    function intentar() {
      var clave = input.value.trim();
      if (!clave) return;
      btn.disabled = true;
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
            input.value = "";
            input.focus();
            btn.disabled = false;
            btn.textContent = "Confirmar";
          }
        })
        .catch(function() {
          errEl.textContent = "Error de conexión. Intentá de nuevo.";
          errEl.classList.remove("hidden");
          btn.disabled = false;
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


var allData    = {};
var allFacturas = [];
var charts     = {};
var sectionActual = "home";
var periodEgresos = "hoy";
var periodHist    = "semana";
var viewParticipacion = "donut"; // "donut" | "bar"

function getObjetivos() {
  try {
    var saved = localStorage.getItem("vvglobal_objetivos");
    return saved ? JSON.parse(saved) : Object.assign({}, OBJETIVOS_DEFAULT);
  } catch(e) { return Object.assign({}, OBJETIVOS_DEFAULT); }
}

// ===================== HELPERS =====================
function today() { return new Date().toISOString().slice(0,10); }
function mesActual() { return new Date().toISOString().slice(0,7); }

function fmtM(n) {
  if (!n && n !== 0) return "—";
  if (Math.abs(n) >= 1000000) return "$" + (n/1000000).toFixed(2) + "M";
  if (Math.abs(n) >= 1000)    return "$" + (n/1000).toFixed(0) + "K";
  return "$" + Number(n).toLocaleString("es-AR");
}

function fmtFull(n) {
  if (!n && n !== 0) return "—";
  return "$" + Number(n).toLocaleString("es-AR");
}

// Devuelve ingresos de ventas de un registro (nuevo o viejo formato)
function regIngresos(r) {
  if (r.tipo === "ventas")       return r.totalVentas  || 0;
  if (r.tipo === "movimientos")  return r.totalIngInter || 0;
  if (r.tipo === "merma")        return 0;
  // Formato viejo (sin campo tipo)
  return r.totalIngresos || 0;
}

// Devuelve egresos de un registro
function regEgresos(r) {
  if (r.tipo === "ventas")      return 0;
  if (r.tipo === "merma")       return 0;
  if (r.tipo === "movimientos") return r.totalEgresos || 0;
  // Formato viejo
  return r.totalEgresos || 0;
}

function sumField(fecha, suc, campo) {
  var regs = (allData[fecha] && allData[fecha][suc]) ? allData[fecha][suc] : [];
  return regs.reduce(function(a, r) {
    if (campo === "totalIngresos") return a + regIngresos(r);
    if (campo === "totalEgresos")  return a + regEgresos(r);
    return a + (r[campo] || 0);
  }, 0);
}

function sumRubro(fecha, suc, tipo, rubroId) {
  var regs = (allData[fecha] && allData[fecha][suc]) ? allData[fecha][suc] : [];
  return regs.reduce(function(a, r) {
    if (tipo === "ingresos") {
      // Nuevo formato: ventas{}
      if (r.tipo === "ventas" && r.ventas && r.ventas[rubroId])
        return a + r.ventas[rubroId];
      // Viejo formato: ingresos{}
      if (!r.tipo && r.ingresos && r.ingresos[rubroId])
        return a + r.ingresos[rubroId];
      return a;
    }
    if (tipo === "egresos") {
      // Nuevo formato: egresos{} dentro de movimientos
      if (r.tipo === "movimientos" && r.egresos && r.egresos[rubroId])
        return a + r.egresos[rubroId];
      // Viejo formato: egresos{}
      if (!r.tipo && r.egresos && r.egresos[rubroId])
        return a + r.egresos[rubroId];
      return a;
    }
    return a + ((r[tipo] && r[tipo][rubroId]) ? r[tipo][rubroId] : 0);
  }, 0);
}

function diasDeMes(mes) {
  return Object.keys(allData).filter(function(f) { return f.slice(0,7) === mes; }).sort();
}

function mesAnterior() {
  var d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0,7);
}

function ultimosDias(n) {
  var days = [];
  for (var i = n-1; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0,10));
  }
  return days;
}

// ===================== NAVEGACIÓN =====================
function initNav() {
  var hamburger = document.getElementById("hamburger");
  var sidebar   = document.getElementById("sidebar");
  var overlay   = document.getElementById("nav-overlay");
  var closeBtn  = document.getElementById("sidebar-close");

  hamburger.addEventListener("click", function() {
    sidebar.classList.add("open");
    overlay.classList.add("show");
  });
  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  }
  overlay.addEventListener("click", closeSidebar);
  closeBtn.addEventListener("click", closeSidebar);

  document.querySelectorAll(".menu-item").forEach(function(item) {
    item.addEventListener("click", function() {
      var sec = item.getAttribute("data-section");
      goToSection(sec);
      closeSidebar();
    });
  });
}

function goToSection(sec) {
  document.querySelectorAll(".section").forEach(function(s) { s.classList.remove("active"); });
  document.querySelectorAll(".menu-item").forEach(function(m) { m.classList.remove("active"); });
  document.getElementById("section-" + sec).classList.add("active");
  document.querySelector("[data-section='" + sec + "']").classList.add("active");
  sectionActual = sec;

  var titles = { home:"Dashboard", objetivos:"Objetivos", facturas:"Facturas", egresos:"Egresos", merma:"Merma", historial:"Historial", deudas:"Deudas" };
  document.getElementById("section-title").textContent = titles[sec] || sec;

  if (sec === "objetivos")  renderObjetivos();
  if (sec === "facturas")   renderFacturas();
  if (sec === "egresos")    renderEgresos(periodEgresos);
  if (sec === "merma")      renderMerma();
  if (sec === "historial")  renderHistorial(periodHist);
  if (sec === "deudas") renderDeudas();
}

// ===================== SECCIÓN: HOME =====================
function renderHome() {
  var fecha = today();
  var totalIng = 0, totalEg = 0;

  // Limpiar y reconstruir suc-grid
  var grid = document.getElementById("suc-grid-home");
  grid.innerHTML = "";
  SUCURSALES.forEach(function(suc) {
    var ing = sumField(fecha, suc, "totalIngresos");
    var eg  = sumField(fecha, suc, "totalEgresos");
    var neto = ing - eg;
    totalIng += ing;
    totalEg  += eg;
    var regs = (allData[fecha] && allData[fecha][suc]) ? allData[fecha][suc] : [];
    var card = document.createElement("div");
    card.className = "suc-card";
    card.setAttribute("data-suc", suc);
    card.innerHTML =
      '<div class="suc-name">' + suc + '</div>' +
      '<div class="suc-row"><span class="sr-label">Ingresos</span><span class="sr-val ing">' + fmtM(ing) + '</span></div>' +
      '<div class="suc-row"><span class="sr-label">Egresos</span><span class="sr-val eg">'  + fmtM(eg)  + '</span></div>' +
      '<div class="suc-row"><span class="sr-label">Neto</span><span class="sr-val" style="color:' + (neto>=0?"var(--green)":"var(--red)") + '">' + fmtM(neto) + '</span></div>' +
      '<div class="sr-regs">' + regs.length + (regs.length===1?" carga":" cargas") + '</div>';
    grid.appendChild(card);
  });

  document.getElementById("global-ing").textContent = fmtM(totalIng);
  document.getElementById("global-eg").textContent  = fmtM(totalEg);
  var neto = totalIng - totalEg;
  var elNet = document.getElementById("global-net");
  elNet.textContent = fmtM(neto);
  elNet.style.color = neto >= 0 ? "var(--green)" : "var(--red)";

  renderFeed();
  renderChartsHome();
  renderSemanal();
}

function renderFeed() {
  var container = document.getElementById("feed-home");
  var todos = [];
  Object.keys(allData).forEach(function(fecha) {
    Object.keys(allData[fecha]).forEach(function(suc) {
      allData[fecha][suc].forEach(function(r) {
        todos.push(Object.assign({}, r, { _fecha: fecha }));
      });
    });
  });
  todos.sort(function(a,b) { return b.timestamp - a.timestamp; });
  var ultimos = todos.slice(0, 15);

  if (!ultimos.length) {
    container.innerHTML = '<div class="empty-st">Sin registros todavía.</div>';
    return;
  }
  container.innerHTML = "";
  ultimos.forEach(function(r) {
    var ts   = new Date(r.timestamp);
    var hora = ts.toLocaleTimeString("es-AR", {hour:"2-digit",minute:"2-digit"});
    var fdia = ts.toLocaleDateString("es-AR", {day:"2-digit",month:"2-digit"});
    var c    = COLORS[r.sucursal] || "#888";
    var div  = document.createElement("div");
    div.className = "feed-item";

    var numsHtml;
    if (r.tipo === "merma") {
      numsHtml = '<span class="feed-badge-tipo feed-merma">📦 Merma · ' + fmtM(r.totalMerma||0) + '</span>';
    } else if (r.tipo === "cierre") {
      numsHtml = '<span class="feed-badge-tipo feed-cierre">🔒 Cierre</span>';
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
      '<div class="feed-suc" style="background:' + c + '20;color:' + c + '">' + r.sucursal + '</div>' +
      '<div class="feed-info">' +
        '<span class="feed-time">' + fdia + ' ' + hora + '</span>' +
        (r.nota ? '<span class="feed-nota">' + r.nota + '</span>' : '') +
      '</div>' +
      numsHtml;
    container.appendChild(div);
  });
}

function renderChartsHome() {
  var mes  = mesActual();
  var dias = diasDeMes(mes);

  var mesLabel = new Date().toLocaleDateString("es-AR", {month:"long",year:"numeric"}).toUpperCase();
  var subtitleLinea = document.querySelector("#section-home .chart-subtitle");
  if (subtitleLinea) subtitleLinea.textContent = "Línea del mes — " + mesLabel;

  var tooltipBase = { backgroundColor:"#1a1a1a", borderColor:"#2a2a2a", borderWidth:1, titleColor:"#f0f0f0", bodyColor:"#666" };
  var scalesBase  = {
    x: { ticks:{color:"#555",font:{size:10}}, grid:{color:"#1f1f1f"} },
    y: { ticks:{color:"#555",font:{size:10},callback:function(v){return fmtM(v);}}, grid:{color:"#1f1f1f"} }
  };
  var legendBase = { labels:{color:"#888",font:{size:11,family:"Space Grotesk"},boxWidth:10} };

  // Línea
  if (dias.length) {
    var labels   = dias.map(function(d){return d.slice(8);});
    var datasets = SUCURSALES.map(function(suc) {
      return {
        label: suc,
        data:  dias.map(function(f){return sumField(f,suc,"totalIngresos");}),
        borderColor: COLORS[suc], backgroundColor: COLORS[suc]+"22",
        borderWidth:2.5, pointRadius:3, pointBackgroundColor:COLORS[suc],
        fill:false, tension:0.3
      };
    });
    if (charts.linea) charts.linea.destroy();
    charts.linea = new Chart(document.getElementById("chart-linea"), {
      type:"line", data:{labels:labels,datasets:datasets},
      options:{responsive:true,plugins:{legend:legendBase,tooltip:tooltipBase},scales:scalesBase}
    });

    var totMes = SUCURSALES.map(function(suc) {
      return dias.reduce(function(a,f){return a+sumField(f,suc,"totalIngresos");},0);
    });

    renderParticipacion(totMes);
  }
}

function renderParticipacion(totMes) {
  if (!totMes) {
    // Recalcular si no se pasan datos
    var mes  = mesActual();
    var dias = diasDeMes(mes);
    totMes = SUCURSALES.map(function(suc) {
      return dias.reduce(function(a,f){return a+sumField(f,suc,"totalIngresos");},0);
    });
  }
  var totalMes = totMes.reduce(function(a,b){return a+b;},0);
  var tooltipBase = { backgroundColor:"#1a1a1a", borderColor:"#2a2a2a", borderWidth:1, titleColor:"#f0f0f0", bodyColor:"#888" };

  if (charts.donut) { charts.donut.destroy(); charts.donut = null; }

  if (viewParticipacion === "donut") {
    charts.donut = new Chart(document.getElementById("chart-donut"), {
      type: "doughnut",
      data: {
        labels: SUCURSALES,
        datasets: [{
          data: totMes,
          backgroundColor: SUCURSALES.map(function(s){ return COLORS[s]; }),
          borderColor: "#0a0a0a",
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        cutout: "60%",
        responsive: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#aaa",
              font: { size: 11, family: "Space Grotesk" },
              boxWidth: 10, padding: 12,
              generateLabels: function() {
                return SUCURSALES.map(function(suc, i) {
                  var val = totMes[i];
                  var pct = totalMes > 0 ? (val/totalMes*100).toFixed(1) : "0.0";
                  return {
                    text:        suc + "  " + pct + "%",
                    fillStyle:   COLORS[suc],
                    strokeStyle: COLORS[suc],
                    fontColor:   "#aaa",
                    color:       "#aaa",
                    index: i
                  };
                });
              }
            }
          },
          tooltip: {
            backgroundColor: "#1a1a1a",
            borderColor: "#2a2a2a",
            borderWidth: 1,
            callbacks: {
              label: function(ctx) {
                var pct = totalMes > 0 ? (ctx.raw/totalMes*100).toFixed(1) : "0.0";
                return "  " + ctx.label + ": " + fmtFull(ctx.raw) + "  (" + pct + "%)";
              }
            }
          }
        }
      }
    });

  } else {
    // Vista de columnas
    charts.donut = new Chart(document.getElementById("chart-donut"), {
      type: "bar",
      data: {
        labels: SUCURSALES,
        datasets: [{
          label: "Acumulado mes",
          data: totMes,
          backgroundColor: SUCURSALES.map(function(s){ return COLORS[s] + "cc"; }),
          borderColor:      SUCURSALES.map(function(s){ return COLORS[s]; }),
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipBase,
            callbacks: {
              label: function(ctx) {
                var pct = totalMes > 0 ? (ctx.raw/totalMes*100).toFixed(1) : "0.0";
                return "  " + fmtFull(ctx.raw) + "  (" + pct + "%)";
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: "#888", font: { size: 10, family: "Space Grotesk" } },
            grid:  { display: false }
          },
          y: {
            ticks: { color: "#555", font: { size: 10 }, callback: function(v){ return fmtM(v); } },
            grid:  { color: "#1f1f1f" }
          }
        }
      }
    });
  }
}

function initToggleParticipacion() {
  document.getElementById("toggle-participacion").addEventListener("click", function(e) {
    var btn = e.target.closest(".chart-view-btn");
    if (!btn) return;
    document.querySelectorAll("#toggle-participacion .chart-view-btn").forEach(function(b){ b.classList.remove("active"); });
    btn.classList.add("active");
    viewParticipacion = btn.getAttribute("data-val");
    renderParticipacion(null);
  });
}

// ===================== SECCIÓN: OBJETIVOS =====================

// Calcula días hábiles (lunes a sábado) restantes en el mes desde mañana
function calcDiasHabiles() {
  var hoy     = new Date();
  var anio    = hoy.getFullYear();
  var mes     = hoy.getMonth();
  var ultimo  = new Date(anio, mes + 1, 0).getDate(); // último día del mes
  var transcurridos = 0; // hábiles ya pasados (incluyendo hoy)
  var restantes     = 0; // hábiles que faltan (desde mañana)
  var totales       = 0; // hábiles totales del mes

  for (var d = 1; d <= ultimo; d++) {
    var dia = new Date(anio, mes, d).getDay(); // 0=dom, 6=sab
    if (dia === 0) continue; // saltar domingos
    totales++;
    if (d <= hoy.getDate()) transcurridos++;
    else                    restantes++;
  }
  return { transcurridos: transcurridos, restantes: restantes, totales: totales };
}

function renderObjetivos() {
  var obj   = getObjetivos();
  var mes   = mesActual();
  var dias  = diasDeMes(mes);
  var cont  = document.getElementById("obj-cards");
  var habil = calcDiasHabiles();
  cont.innerHTML = "";

  // Totales globales
  var acumTotal = 0, metaTotal = 0;
  SUCURSALES.forEach(function(suc) {
    acumTotal += dias.reduce(function(a,f){return a+sumField(f,suc,"totalIngresos");},0);
    metaTotal += obj[suc] || 0;
  });
  var pctTotal   = metaTotal > 0 ? Math.min((acumTotal/metaTotal)*100, 100) : 0;
  var pctReal    = metaTotal > 0 ? ((acumTotal/metaTotal)*100).toFixed(1) : "0.0";
  var faltaTotal = Math.max(metaTotal - acumTotal, 0);
  var barColor   = pctTotal >= 80 ? "var(--green)" : pctTotal >= 50 ? "#f0a500" : "var(--red)";
  var promReqGlobal = (habil.restantes > 0 && faltaTotal > 0) ? faltaTotal / habil.restantes : 0;
  var promRealGlobal = habil.transcurridos > 0 ? acumTotal / habil.transcurridos : 0;

  var globalCard = document.createElement("div");
  globalCard.className = "obj-global-card";
  globalCard.innerHTML =
    '<div class="obj-global-top">' +
      '<div>' +
        '<div class="obj-global-label">Objetivo global — ' + new Date().toLocaleDateString("es-AR",{month:"long",year:"numeric"}) + '</div>' +
        '<div class="obj-global-vals">' +
          '<span class="obj-global-acum">' + fmtFull(acumTotal) + '</span>' +
          '<span class="obj-global-sep">/</span>' +
          '<span class="obj-global-meta">' + fmtFull(metaTotal) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="obj-global-pct" style="color:' + barColor + '">' + pctReal + '%</div>' +
    '</div>' +
    '<div class="obj-bar-bg" style="height:8px;margin:10px 0 6px"><div class="obj-bar-fill" style="width:' + pctTotal + '%;background:' + barColor + ';height:8px;border-radius:4px"></div></div>' +
    '<div class="obj-global-sub">' +
      (acumTotal >= metaTotal && metaTotal > 0
        ? '<span style="color:var(--green);font-weight:700">✓ Objetivo global alcanzado</span>'
        : '<span>Promedio req. <strong style="color:' + barColor + '">' + fmtFull(Math.ceil(promReqGlobal)) + '/día</strong> · ' +
          habil.restantes + ' días hábiles restantes · Prom. real: ' + fmtM(Math.round(promRealGlobal)) + '/día</span>'
      ) +
    '</div>';
  cont.appendChild(globalCard);

  SUCURSALES.forEach(function(suc) {
    var acum     = dias.reduce(function(a,f){return a+sumField(f,suc,"totalIngresos");},0);
    var meta     = obj[suc] || 0;
    var falta    = Math.max(meta - acum, 0);
    var pct      = meta > 0 ? Math.min((acum/meta)*100, 100) : 0;
    var pctReal  = meta > 0 ? ((acum/meta)*100).toFixed(1) : "0.0";
    var barColor = pct >= 80 ? "var(--green)" : pct >= 50 ? "#f0a500" : "var(--red)";

    // Promedio diario requerido para llegar al objetivo con los días hábiles restantes
    var promReq = (habil.restantes > 0 && falta > 0)
      ? falta / habil.restantes
      : 0;
    // Promedio diario real hasta hoy (solo días transcurridos hábiles)
    var promReal = habil.transcurridos > 0 ? acum / habil.transcurridos : 0;
    // Si ya se cumplió el objetivo
    var yaAlcanzo = acum >= meta && meta > 0;

    var card = document.createElement("div");
    card.className = "obj-card";
    card.setAttribute("data-suc", suc);

    var promHtml;
    if (yaAlcanzo) {
      promHtml = '<div class="obj-prom-row obj-prom-ok">✓ Objetivo alcanzado</div>';
    } else if (habil.restantes === 0) {
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
      promHtml;
    cont.appendChild(card);
  });
}

function initObjetivosModal() {
  var btnEdit   = document.getElementById("btn-edit-obj");
  var modal     = document.getElementById("obj-modal");
  var btnCancel = document.getElementById("btn-cancel-obj");
  var btnSave   = document.getElementById("btn-save-obj");
  var fields    = document.getElementById("obj-fields");

  btnEdit.addEventListener("click", function() {
    pedirClaveAdmin().then(function(ok) {
      if (!ok) { alert("Clave incorrecta."); return; }
      var obj = getObjetivos();
        fields.innerHTML = "";
        SUCURSALES.forEach(function(suc) {
          var row = document.createElement("div");
          row.className = "obj-field-row";
          row.innerHTML =
            '<label>' + suc + '</label>' +
            '<div class="obj-input-wrap">' +
              '<span class="obj-prefix">$</span>' +
              '<input type="number" id="obj-inp-' + suc + '" value="' + (obj[suc]||0) + '" min="0" step="100000">' +
            '</div>';
          fields.appendChild(row);
        });
        modal.classList.remove("hidden");
      });
  });

  btnCancel.addEventListener("click", function() { modal.classList.add("hidden"); });

  btnSave.addEventListener("click", function() {
    var obj = {};
    SUCURSALES.forEach(function(suc) {
      obj[suc] = parseFloat(document.getElementById("obj-inp-" + suc).value) || 0;
    });
    localStorage.setItem("vvglobal_objetivos", JSON.stringify(obj));
    modal.classList.add("hidden");
    renderObjetivos();
  });
}

// ===================== SECCIÓN: FACTURAS =====================
var facturasMesViendo = mesActual(); // "YYYY-MM"

function semanasDelMes(mes) {
  // Devuelve array de semanas [{label, desde, hasta}] donde desde/hasta son "YYYY-MM-DD"
  var anio  = parseInt(mes.slice(0,4));
  var mesN  = parseInt(mes.slice(5,7)) - 1;
  var primer = new Date(anio, mesN, 1);
  var ultimo  = new Date(anio, mesN + 1, 0);
  var semanas = [];
  var sem = 1;
  var d = new Date(primer);
  while (d <= ultimo) {
    var desde = d.toISOString().slice(0,10);
    // fin de semana: siguiente domingo o fin de mes
    var fin = new Date(d);
    fin.setDate(fin.getDate() + (6 - fin.getDay()));
    if (fin > ultimo) fin = new Date(ultimo);
    var hasta = fin.toISOString().slice(0,10);
    semanas.push({ label: "SEM " + sem, desde: desde, hasta: hasta });
    sem++;
    d = new Date(fin);
    d.setDate(d.getDate() + 1);
  }
  return semanas;
}

function renderFacturas() {
  var mes    = facturasMesViendo;
  var anio   = mes.slice(0,4);
  var mesN   = parseInt(mes.slice(5,7));
  var nombres = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  document.getElementById("fact-mes-label").textContent = nombres[mesN] + " " + anio;

  var semanas = semanasDelMes(mes);
  var facturas = allFacturas || [];
  var del_mes  = facturas.filter(function(f){ return f.fecha && f.fecha.slice(0,7) === mes; });

  // Ordenar por fecha desc
  del_mes.sort(function(a,b){ return b.fecha.localeCompare(a.fecha); });

  // RESUMEN: tabla sucursal × semana
  var thead = document.getElementById("fact-resumen-thead");
  var tbody = document.getElementById("fact-resumen-tbody");

  thead.innerHTML = "<tr><th>Sucursal</th>" +
    semanas.map(function(s){ return "<th>" + s.label + "</th>"; }).join("") +
    "<th>Total</th></tr>";

  // Calcular totales
  var totSem = semanas.map(function(){ return 0; });
  var totGlobal = 0;
  tbody.innerHTML = "";

  SUCURSALES.forEach(function(suc) {
    var c = COLORS[suc];
    var rowTot = 0;
    var celdas = semanas.map(function(s, i) {
      var sum = del_mes.filter(function(f){
        return f.sucursal === suc && f.fecha >= s.desde && f.fecha <= s.hasta;
      }).reduce(function(a,f){ return a + (f.monto||0); }, 0);
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

  // Fila total
  var trTot = document.createElement("tr");
  trTot.className = "fact-row-total";
  trTot.innerHTML =
    "<td>TOTAL</td>" +
    totSem.map(function(t){ return "<td class='fact-td-num'>" + (t ? fmtFull(t) : "—") + "</td>"; }).join("") +
    "<td class='fact-td-tot'>" + (totGlobal ? fmtFull(totGlobal) : "—") + "</td>";
  tbody.appendChild(trTot);

  // LISTA DE FACTURAS
  var listaTbody = document.getElementById("fact-lista-tbody");
  listaTbody.innerHTML = "";
  if (!del_mes.length) {
    listaTbody.innerHTML = "<tr><td colspan='6' class='fact-empty-row'>Sin facturas para este mes.</td></tr>";
    return;
  }
  del_mes.forEach(function(f) {
    var c  = COLORS[f.sucursal] || "#888";
    var tr = document.createElement("tr");
    tr.innerHTML =
      "<td><span class='fact-suc-badge' style='color:" + c + "'>" + f.sucursal + "</span></td>" +
      "<td class='fact-td-prov'>" + (f.proveedor||"—") + "</td>" +
      "<td class='fact-td-num'>" + (f.numero||"—") + "</td>" +
      "<td class='fact-td-fecha'>" + (f.fecha ? f.fecha.split("-").reverse().join("/") : "—") + "</td>" +
      "<td class='fact-td-monto'>" + fmtFull(f.monto||0) + "</td>" +
      "<td><button class='fact-btn-del' data-id='" + f._id + "'>✕</button></td>";
    listaTbody.appendChild(tr);
  });

  // Listeners de borrado
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

function guardarFactura() {
  var suc      = document.getElementById("fact-sucursal").value;
  var prov     = document.getElementById("fact-proveedor").value.trim();
  var numero   = document.getElementById("fact-numero").value.trim();
  var fecha    = document.getElementById("fact-fecha").value;
  var monto    = parseFloat(document.getElementById("fact-monto").value) || 0;

  if (!suc)    { alert("Seleccioná una sucursal."); return; }
  if (!prov)   { alert("Ingresá el proveedor."); return; }
  if (!fecha)  { alert("Ingresá la fecha."); return; }
  if (!monto)  { alert("Ingresá el monto."); return; }

  var btn = document.getElementById("btn-guardar-fact");
  btn.disabled = true; btn.textContent = "Verificando...";

  pedirClaveAdmin().then(function(ok) {
    if (!ok) {
      alert("Clave incorrecta. No se guardó la factura.");
      btn.disabled = false; btn.textContent = "+ Cargar Factura";
      return;
    }
    btn.textContent = "Guardando...";
    firebase.database().ref("facturas").push({
      sucursal:  suc,
      proveedor: prov,
      numero:    numero,
      fecha:     fecha,
      monto:     monto,
      timestamp: Date.now()
    })
    .then(function() {
      document.getElementById("fact-sucursal").value  = "";
      document.getElementById("fact-proveedor").value = "";
      document.getElementById("fact-numero").value    = "";
      document.getElementById("fact-fecha").value     = today();
      document.getElementById("fact-monto").value     = "";
    })
    .catch(function(e){ alert("Error al guardar: " + e.message); })
    .finally(function(){ btn.disabled = false; btn.textContent = "+ Cargar Factura"; });
  });
}

function exportarFacturasCSV() {
  var mes    = facturasMesViendo;
  var lista  = (allFacturas||[]).filter(function(f){ return f.fecha && f.fecha.slice(0,7) === mes; });
  if (!lista.length) { alert("No hay facturas para exportar en este mes."); return; }
  lista.sort(function(a,b){ return a.fecha.localeCompare(b.fecha); });

  var csv = "Sucursal,Proveedor,N° Factura,Fecha,Monto\n";
  lista.forEach(function(f) {
    csv += [
      f.sucursal, '"' + (f.proveedor||"").replace(/"/g,'""') + '"',
      '"' + (f.numero||"") + '"',
      f.fecha ? f.fecha.split("-").reverse().join("/") : "",
      f.monto||0
    ].join(",") + "\n";
  });

  var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement("a");
  a.href = url;
  a.download = "facturas-" + mes + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

function initFacturas() {
  // Fecha default = hoy
  document.getElementById("fact-fecha").value = today();

  document.getElementById("btn-guardar-fact").addEventListener("click", guardarFactura);
  document.getElementById("btn-export-facturas").addEventListener("click", exportarFacturasCSV);

  document.getElementById("fact-mes-prev").addEventListener("click", function() {
    var d = new Date(facturasMesViendo + "-01");
    d.setMonth(d.getMonth() - 1);
    facturasMesViendo = d.toISOString().slice(0,7);
    renderFacturas();
  });
  document.getElementById("fact-mes-next").addEventListener("click", function() {
    var d = new Date(facturasMesViendo + "-01");
    d.setMonth(d.getMonth() + 1);
    facturasMesViendo = d.toISOString().slice(0,7);
    renderFacturas();
  });
}



// ===================== SECCIÓN: EGRESOS =====================
function renderEgresos(period) {
  periodEgresos = period;
  var fechas = period === "hoy" ? [today()] : diasDeMes(mesActual());

  var totales = {};
  RUBROS_EG.forEach(function(r){ totales[r.id] = 0; });
  fechas.forEach(function(f) {
    SUCURSALES.forEach(function(suc) {
      RUBROS_EG.forEach(function(r) {
        totales[r.id] += sumRubro(f, suc, "egresos", r.id);
      });
    });
  });

  var labels = RUBROS_EG.map(function(r){return r.label;});
  var data   = RUBROS_EG.map(function(r){return totales[r.id];});
  var colors = ["#ff6b6b","#f0a500","#4da6ff","#c084fc","#888"];

  if (charts.egresosDonut) charts.egresosDonut.destroy();
  charts.egresosDonut = new Chart(document.getElementById("chart-egresos-donut"), {
    type: "doughnut",
    data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderColor: "#111", borderWidth: 2, hoverOffset: 5 }] },
    options: {
      cutout: "72%",
      responsive: true,
      plugins: {
        legend: { position: "right", labels: { color: "#888", font: { size: 10, family: "Space Grotesk" }, boxWidth: 8, padding: 10 } },
        tooltip: { backgroundColor: "#1a1a1a", callbacks: { label: function(ctx) {
          var t = ctx.dataset.data.reduce(function(a,b){return a+b;},0);
          return "  " + ctx.label + ": " + fmtM(ctx.raw) + " (" + (t>0?(ctx.raw/t*100).toFixed(1):0) + "%)";
        }}}
      }
    }
  });

  var cont = document.getElementById("egresos-detalle");
  cont.innerHTML = "";
  SUCURSALES.forEach(function(suc) {
    var suctot = fechas.reduce(function(a,f){return a+sumField(f,suc,"totalEgresos");},0);
    if (!suctot) return;
    var card = document.createElement("div");
    card.className = "detalle-suc-card";
    var html = '<div class="detalle-suc-title">' + suc + '</div>';
    RUBROS_EG.forEach(function(r) {
      var val = fechas.reduce(function(a,f){return a+sumRubro(f,suc,"egresos",r.id);},0);
      if (!val) return;
      var pct = suctot > 0 ? (val/suctot*100) : 0;
      html +=
        '<div class="detalle-row">' +
          '<span class="detalle-row-label">' + r.label + '</span>' +
          '<div class="detalle-row-right">' +
            '<div class="detalle-mini-bar-bg"><div class="detalle-mini-bar-fill" style="width:' + pct + '%;background:var(--red)"></div></div>' +
            '<span class="detalle-row-val">' + fmtM(val) + '</span>' +
          '</div>' +
        '</div>';
    });
    card.innerHTML = html;
    cont.appendChild(card);
  });
}

function initToggleEgresos() {
  document.getElementById("toggle-egresos").addEventListener("click", function(e) {
    var btn = e.target.closest(".toggle-btn");
    if (!btn) return;
    document.querySelectorAll("#toggle-egresos .toggle-btn").forEach(function(b){b.classList.remove("active");});
    btn.classList.add("active");
    renderEgresos(btn.getAttribute("data-val"));
  });
}

// ===================== SECCIÓN: MERMA =====================
var MOTIVOS_MERMA = {
  vencimiento: "Vencimiento",
  deterioro:   "Deterioro",
  rotura:      "Rotura",
  robo:        "Robo / faltante",
  otros:       "Otros"
};

function getMermaRegs(fecha, suc) {
  var regs = (allData[fecha] && allData[fecha][suc]) ? allData[fecha][suc] : [];
  return regs.filter(function(r){ return r.tipo === "merma"; });
}

function renderMerma() {
  var mes        = mesActual();
  var fechasMes  = diasDeMes(mes);
  var strip      = document.getElementById("merma-global-strip");
  var detCont    = document.getElementById("merma-detalle");
  strip.innerHTML   = "";
  detCont.innerHTML = "";

  // Totales globales
  var totalGlobal    = 0;
  var totalPorMotivo = {};
  Object.keys(MOTIVOS_MERMA).forEach(function(k){ totalPorMotivo[k] = 0; });

  var totalesPorSuc  = {};
  SUCURSALES.forEach(function(suc){ totalesPorSuc[suc] = 0; });

  fechasMes.forEach(function(f) {
    SUCURSALES.forEach(function(suc) {
      getMermaRegs(f, suc).forEach(function(r) {
        var t = r.totalMerma || 0;
        totalGlobal         += t;
        totalesPorSuc[suc]  += t;
        (r.items || []).forEach(function(item) {
          if (totalPorMotivo[item.motivo] !== undefined) {
            totalPorMotivo[item.motivo] += item.total || 0;
          } else {
            totalPorMotivo["otros"] += item.total || 0;
          }
        });
      });
    });
  });

  // Strip global
  var stripHtml =
    '<div class="merma-strip-card merma-strip-total">' +
      '<div class="ms-label">Total mes</div>' +
      '<div class="ms-val">' + fmtM(totalGlobal) + '</div>' +
    '</div>';
  SUCURSALES.forEach(function(suc) {
    var pct = totalGlobal > 0 ? (totalesPorSuc[suc] / totalGlobal * 100).toFixed(1) : "0.0";
    var c   = COLORS[suc];
    stripHtml +=
      '<div class="merma-strip-card">' +
        '<div class="ms-suc" style="color:' + c + '">' + suc + '</div>' +
        '<div class="ms-val">' + fmtM(totalesPorSuc[suc]) + '</div>' +
        '<div class="ms-pct">' + pct + '%</div>' +
      '</div>';
  });
  strip.innerHTML = stripHtml;

  if (!totalGlobal) {
    detCont.innerHTML = '<div class="empty-st" style="padding:40px 0">Sin registros de merma este mes.</div>';
    return;
  }

  // Detalle por sucursal
  SUCURSALES.forEach(function(suc) {
    if (!totalesPorSuc[suc]) return;

    // Recolectar todos los ítems del mes para esta sucursal
    var itemsAgrup = {}; // producto -> { cantidad, total, motivos[] }
    var registros  = []; // para el desglose cronológico

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
        registros.push({ fecha: f, reg: r });
      });
    });

    var card = document.createElement("div");
    card.className = "merma-suc-card";
    card.setAttribute("data-suc", suc);

    var c = COLORS[suc];

    // Tabla de productos agrupados
    var rows = "";
    Object.keys(itemsAgrup)
      .sort(function(a,b){ return itemsAgrup[b].total - itemsAgrup[a].total; })
      .forEach(function(prod) {
        var it     = itemsAgrup[prod];
        var pct    = totalesPorSuc[suc] > 0 ? (it.total / totalesPorSuc[suc] * 100) : 0;
        var motTop = Object.keys(it.motivos).sort(function(a,b){ return it.motivos[b]-it.motivos[a]; })[0];
        rows +=
          '<tr>' +
            '<td class="merma-td-prod">' + prod + '</td>' +
            '<td class="merma-td-num">' + it.cantidad + ' u.</td>' +
            '<td class="merma-td-motivo">' + (MOTIVOS_MERMA[motTop] || motTop) + '</td>' +
            '<td class="merma-td-tot">' + fmtM(it.total) + '</td>' +
            '<td class="merma-td-bar"><div class="merma-mini-bar"><div style="width:' + pct + '%;background:' + c + '"></div></div></td>' +
          '</tr>';
      });

    card.innerHTML =
      '<div class="merma-suc-header">' +
        '<span class="merma-suc-name" style="color:' + c + '">' + suc + '</span>' +
        '<span class="merma-suc-total">' + fmtFull(totalesPorSuc[suc]) + '</span>' +
      '</div>' +
      '<div class="merma-tabla-wrap">' +
        '<table class="merma-tabla">' +
          '<thead><tr>' +
            '<th>Producto</th><th>Cant.</th><th>Motivo</th><th>Total</th><th></th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>';

    detCont.appendChild(card);
  });
}


function renderHistorial(period) {
  periodHist = period;
  var mes = mesActual();
  var mesAnt = mesAnterior();

  var fechas;
  if (period === "semana")   fechas = ultimosDias(7);
  else if (period === "mes") fechas = diasDeMes(mes);
  else                       fechas = diasDeMes(mesAnt);

  var labels   = fechas.map(function(d){return d.slice(5);});
  var tooltipBase = {backgroundColor:"#1a1a1a",borderColor:"#2a2a2a",borderWidth:1,titleColor:"#f0f0f0",bodyColor:"#666"};
  var scalesBase  = {
    x:{ticks:{color:"#555",font:{size:10}},grid:{color:"#1f1f1f"}},
    y:{ticks:{color:"#555",font:{size:10},callback:function(v){return fmtM(v);}},grid:{color:"#1f1f1f"}}
  };

  var datasets = SUCURSALES.map(function(suc) {
    return {
      label:suc, data:fechas.map(function(f){return sumField(f,suc,"totalIngresos");}),
      borderColor:COLORS[suc], backgroundColor:COLORS[suc]+"22",
      borderWidth:2, pointRadius:2.5, pointBackgroundColor:COLORS[suc],
      fill:false, tension:0.3
    };
  });

  if (charts.hist) charts.hist.destroy();
  charts.hist = new Chart(document.getElementById("chart-hist"), {
    type:"line", data:{labels:labels,datasets:datasets},
    options:{responsive:true,plugins:{legend:{labels:{color:"#888",font:{size:10,family:"Space Grotesk"},boxWidth:8}},tooltip:tooltipBase},scales:scalesBase}
  });

  // Tabla de días
  var tabla = document.getElementById("hist-tabla");
  tabla.innerHTML = "";
  if (!fechas.length) { tabla.innerHTML = '<div class="empty-st">Sin datos para este período.</div>'; return; }

  var tbl = document.createElement("table");
  var thead = '<thead><tr><th>Fecha</th>';
  SUCURSALES.forEach(function(s){ thead += '<th>' + s + '</th>'; });
  thead += '<th>TOTAL</th></tr></thead>';
  var tbody = '<tbody>';
  fechas.forEach(function(f) {
    var rowTotal = 0;
    var row = '<tr><td>' + f.slice(5) + '</td>';
    SUCURSALES.forEach(function(suc) {
      var v = sumField(f, suc, "totalIngresos");
      rowTotal += v;
      row += '<td class="td-ing">' + (v ? fmtM(v) : "—") + '</td>';
    });
    row += '<td class="td-ing" style="font-weight:700">' + fmtM(rowTotal) + '</td>';
    row += '</tr>';
    tbody += row;
  });
  tbody += '</tbody>';
  tbl.innerHTML = thead + tbody;
  tabla.appendChild(tbl);
}

function initToggleHist() {
  document.getElementById("toggle-hist").addEventListener("click", function(e) {
    var btn = e.target.closest(".toggle-btn");
    if (!btn) return;
    document.querySelectorAll("#toggle-hist .toggle-btn").forEach(function(b){b.classList.remove("active");});
    btn.classList.add("active");
    renderHistorial(btn.getAttribute("data-val"));
  });
}

// ===================== SECCIÓN: SEMANAL =====================
function semanasDelMesActual() {
  var hoy    = new Date();
  var anio   = hoy.getFullYear();
  var mesN   = hoy.getMonth();
  var primer = new Date(anio, mesN, 1);
  var ultimo  = new Date(anio, mesN + 1, 0);
  var semanas = [];
  var sem = 1;
  var d = new Date(primer);
  while (d <= ultimo) {
    var desde = d.toISOString().slice(0,10);
    var fin   = new Date(d);
    fin.setDate(fin.getDate() + (6 - fin.getDay()));
    if (fin > ultimo) fin = new Date(ultimo);
    var hasta = fin.toISOString().slice(0,10);
    semanas.push({ label: "SEM " + sem, desde: desde, hasta: hasta });
    sem++;
    d = new Date(fin);
    d.setDate(d.getDate() + 1);
  }
  return semanas;
}

function semanaActual() {
  var hoy     = today();
  var semanas = semanasDelMesActual();
  for (var i = 0; i < semanas.length; i++) {
    if (hoy >= semanas[i].desde && hoy <= semanas[i].hasta) return semanas[i];
  }
  return semanas[semanas.length - 1];
}

function renderSemanal() {
  // Solo renderizar si los elementos existen en el DOM
  var compTbody = document.getElementById("semanal-compras-tbody");
  var ventTbody = document.getElementById("semanal-ventas-tbody");
  if (!compTbody || !ventTbody) return;
  var semanas  = semanasDelMesActual();
  var semHoy   = semanaActual();
  var facturas = allFacturas || [];

  // COMPRAS: facturas + egresos proveedores/insumos
  var comprasSems = semanas.map(function(s) {
    var factTotal = facturas
      .filter(function(f) { return f.fecha && f.fecha >= s.desde && f.fecha <= s.hasta; })
      .reduce(function(a, f) { return a + (f.monto || 0); }, 0);

    var egTotal = 0;
    Object.keys(allData).forEach(function(fecha) {
      if (fecha < s.desde || fecha > s.hasta) return;
      SUCURSALES.forEach(function(suc) {
        (allData[fecha][suc] || []).forEach(function(r) {
          var eg = (r.tipo === "movimientos" || !r.tipo) ? (r.egresos || {}) : {};
          egTotal += eg["proveedores"] || 0;
          egTotal += eg["insumos"]     || 0;
        });
      });
    });
    return { label: s.label, desde: s.desde, facturas: factTotal, egresos: egTotal, total: factTotal + egTotal };
  });

  // VENTAS: todos los medios de pago
  var ventasSems = semanas.map(function(s) {
    var efectivo = 0, digital = 0;
    Object.keys(allData).forEach(function(fecha) {
      if (fecha < s.desde || fecha > s.hasta) return;
      SUCURSALES.forEach(function(suc) {
        (allData[fecha][suc] || []).forEach(function(r) {
          var v = (r.tipo === "ventas") ? (r.ventas || {}) : (!r.tipo ? (r.ingresos || {}) : {});
          efectivo += v["efectivo"]      || 0;
          digital  += v["debito"]        || 0;
          digital  += v["credito"]       || 0;
          digital  += v["transferencia"] || 0;
          digital  += v["mercadopago"]   || 0;
        });
      });
    });
    return { label: s.label, desde: s.desde, efectivo: efectivo, digital: digital, total: efectivo + digital };
  });

  // Totales semana actual
  var compSemActual = comprasSems.find(function(s) { return s.desde === semHoy.desde; }) || { total: 0 };
  var ventSemActual = ventasSems.find(function(s)  { return s.desde === semHoy.desde; }) || { total: 0 };
  document.getElementById("semanal-compras-total").textContent = fmtFull(compSemActual.total);
  document.getElementById("semanal-ventas-total").textContent  = fmtFull(ventSemActual.total);

  // Tabla compras
  var compTbody = document.getElementById("semanal-compras-tbody");
  compTbody.innerHTML = "";
  comprasSems.forEach(function(s) {
    var activo = s.desde === semHoy.desde;
    var tr = document.createElement("tr");
    if (activo) tr.className = "semanal-row-actual";
    tr.innerHTML =
      '<td><span class="semanal-sem-label">' + s.label + '</span>' + (activo ? ' <span class="semanal-badge-actual">actual</span>' : '') + '</td>' +
      '<td class="semanal-td-num">' + (s.facturas ? fmtM(s.facturas) : '—') + '</td>' +
      '<td class="semanal-td-num">' + (s.egresos  ? fmtM(s.egresos)  : '—') + '</td>' +
      '<td class="semanal-td-tot">' + (s.total    ? fmtM(s.total)    : '—') + '</td>';
    compTbody.appendChild(tr);
  });

  // Tabla ventas
  var ventTbody = document.getElementById("semanal-ventas-tbody");
  ventTbody.innerHTML = "";
  ventasSems.forEach(function(s) {
    var activo = s.desde === semHoy.desde;
    var tr = document.createElement("tr");
    if (activo) tr.className = "semanal-row-actual";
    tr.innerHTML =
      '<td><span class="semanal-sem-label">' + s.label + '</span>' + (activo ? ' <span class="semanal-badge-actual">actual</span>' : '') + '</td>' +
      '<td class="semanal-td-num">' + (s.efectivo ? fmtM(s.efectivo) : '—') + '</td>' +
      '<td class="semanal-td-num">' + (s.digital  ? fmtM(s.digital)  : '—') + '</td>' +
      '<td class="semanal-td-tot">' + (s.total    ? fmtM(s.total)    : '—') + '</td>';
    ventTbody.appendChild(tr);
  });
}

function initSemanal() {
  document.querySelectorAll(".semanal-ver-mas").forEach(function(btn) {
    btn.addEventListener("click", function() {
      goToSection(btn.getAttribute("data-goto"));
    });
  });
}

// ===================== CIERRE DE CAJA + TOTAL EFECTIVO =====================
function renderEfectivoTabla() {
  // Ya no hay tabla de efectivo — la info está en renderCierreStrip
}

function renderCierreStrip() {
  var cont     = document.getElementById("cierre-strip-home");
  var totalVal = document.getElementById("cierre-total-val");
  if (!cont) return;
  cont.innerHTML = '<div class="empty-st" style="padding:12px 0;font-size:.78rem">Cargando cierres...</div>';

  firebase.database().ref("cierres/" + today()).once("value", function(snap) {
    cont.innerHTML = "";
    var totalContado = 0;
    var algoCerrado  = false;

    SUCURSALES.forEach(function(suc) {
      var card = document.createElement("div");
      card.className = "cierre-dash-card";
      var c = COLORS[suc];

      if (snap.exists() && snap.child(suc).exists()) {
        var d        = snap.child(suc).val();
        var difSign  = d.diferencia >= 0 ? "+" : "−";
        var difColor = d.diferencia >= 0 ? "var(--green)" : "var(--red)";
        var hora     = new Date(d.timestamp).toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" });
        totalContado += d.contado || 0;
        algoCerrado   = true;
        card.classList.add("cierre-ok");
        card.innerHTML =
          '<div class="cs-suc" style="color:' + c + '">' + suc + '</div>' +
          '<div class="cs-estado cs-cerrado">✓ Cerrado ' + hora + '</div>' +
          '<div class="cs-row"><span class="cs-lbl">Contado</span><span class="cs-val cs-contado-verde">' + fmtM(d.contado) + '</span></div>' +
          '<div class="cs-row"><span class="cs-lbl">Sistema</span><span class="cs-val">' + fmtM(d.saldoSistema) + '</span></div>' +
          '<div class="cs-row"><span class="cs-lbl">Diferencia</span><span class="cs-val" style="color:' + difColor + '">' + difSign + fmtM(Math.abs(d.diferencia)) + '</span></div>' +
          (d.nota ? '<div class="cs-nota">' + d.nota + '</div>' : '');
      } else {
        card.classList.add("cierre-pendiente");
        card.innerHTML =
          '<div class="cs-suc" style="color:' + c + '">' + suc + '</div>' +
          '<div class="cs-estado cs-pendiente">⏳ Sin cerrar</div>';
      }
      cont.appendChild(card);
    });

    // Banner total
    if (totalVal) {
      if (algoCerrado) {
        totalVal.textContent  = fmtFull(totalContado);
        totalVal.style.color  = "var(--green)";
      } else {
        totalVal.textContent = "Sin cierres aún";
        totalVal.style.color = "var(--muted)";
      }
    }
  });
}


function initFirebase() {
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
    renderCierreStrip();
    renderEfectivoTabla(snap);
    if (sectionActual === "objetivos") renderObjetivos();
    if (sectionActual === "egresos")   renderEgresos(periodEgresos);
    if (sectionActual === "merma")     renderMerma();
    if (sectionActual === "historial") renderHistorial(periodHist);
  });

  // Listener de facturas
  firebase.database().ref("facturas").on("value", function(snap) {
    allFacturas = [];
    if (snap.exists()) {
      snap.forEach(function(child) {
        allFacturas.push(Object.assign({ _id: child.key }, child.val()));
      });
    }
    if (sectionActual === "facturas") renderFacturas();
  });
}

// ===================== SECCIÓN: DEUDAS =====================

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

var allDeudas = [];

function guardarDeuda() {
  var cat    = document.getElementById("deuda-categoria").value;
  var desc   = document.getElementById("deuda-descripcion").value.trim();
  var monto  = parseFloat(document.getElementById("deuda-monto").value) || 0;

  if (!cat)   { alert("Seleccioná una categoría."); return; }
  if (!monto) { alert("Ingresá el monto."); return; }

  var btn = document.getElementById("btn-guardar-deuda");
  btn.disabled = true; btn.textContent = "Verificando...";

  pedirClaveAdmin().then(function(ok) {
    if (!ok) {
      alert("Clave incorrecta.");
      btn.disabled = false; btn.textContent = "+ Registrar Deuda";
      return;
    }
    btn.textContent = "Guardando...";
    firebase.database().ref("deudas").push({
      categoria:   cat,
      descripcion: desc,
      montoOriginal: monto,
      montoActual:   monto,
      fecha:       today(),
      timestamp:   Date.now(),
      pagos:       []
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

// ===================== ABONO DEUDA — REEMPLAZA abonarDeuda() =====================
// Pegar esto en dashboard.js reemplazando la función abonarDeuda() existente

function abonarDeuda(id, montoActual) {
  var overlay    = document.getElementById("abono-modal");
  var infoEl     = document.getElementById("abono-modal-info");
  var montoInput = document.getElementById("abono-modal-monto");
  var checkTotal = document.getElementById("abono-pago-total");
  var montoWrap  = document.getElementById("abono-monto-wrap");
  var btn        = document.getElementById("abono-modal-btn");
  var cancelBtn  = document.getElementById("abono-modal-cancel");
  var errEl      = document.getElementById("abono-modal-error");

  // Resetear estado
  montoInput.value = "";
  checkTotal.checked = false;
  montoWrap.style.display = "block";
  montoInput.disabled = false;
  errEl.classList.add("hidden");
  btn.disabled = false;
  btn.textContent = "Confirmar abono";
  infoEl.textContent = "Deuda actual: " + fmtFull(montoActual);

  // Toggle pago total
  function onCheckTotal() {
    if (checkTotal.checked) {
      montoInput.value = montoActual;
      montoInput.disabled = true;
      montoWrap.style.opacity = ".5";
    } else {
      montoInput.value = "";
      montoInput.disabled = false;
      montoWrap.style.opacity = "1";
    }
  }
  checkTotal.addEventListener("change", onCheckTotal);

  // Mostrar modal
  overlay.classList.remove("hidden");
  setTimeout(function() { montoInput.focus(); }, 80);

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
      errEl.textContent = abono > montoActual
        ? "El monto supera la deuda actual."
        : "Ingresá un monto válido.";
      errEl.classList.remove("hidden");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Guardando...";
    errEl.classList.add("hidden");

    var nuevoMonto = Math.max(montoActual - abono, 0);
    var ref = firebase.database().ref("deudas/" + id);

    ref.once("value").then(function(snap) {
      if (!snap.exists()) { cerrar(); return; }
      var d = snap.val();
      var pagos = Array.isArray(d.pagos) ? d.pagos.slice() : [];
      pagos.push({ monto: abono, fecha: today(), timestamp: Date.now() });

      if (nuevoMonto === 0) {
        firebase.database().ref("deudas_historial").push(
          Object.assign({}, d, {
            montoActual: 0,
            pagos: pagos,
            saldadaEl: today(),
            saldadaTs: Date.now()
          })
        ).then(function() { ref.remove(); });
      } else {
        ref.update({ montoActual: nuevoMonto, pagos: pagos });
      }
      cerrar();
    }).catch(function() {
      errEl.textContent = "Error al guardar. Intentá de nuevo.";
      errEl.classList.remove("hidden");
      btn.disabled = false;
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
  var strip  = document.getElementById("deuda-resumen-strip");
  var lista  = document.getElementById("deuda-lista");
  if (!strip || !lista) return;

  // Sumar montos por categoría
  var porCat = {};
  Object.keys(CATS_DEUDA).forEach(function(k) { porCat[k] = 0; });
  allDeudas.forEach(function(d) {
    if (porCat[d.categoria] !== undefined) porCat[d.categoria] += d.montoActual || 0;
    else porCat["proveedores"] += d.montoActual || 0;
  });
  var totalDeuda = Object.values(porCat).reduce(function(a,b){ return a+b; }, 0);

  // Strip resumen — solo muestra el total global
  strip.innerHTML =
    '<div class="deuda-strip-total">' +
      '<div class="ds-label">Total adeudado</div>' +
      '<div class="ds-val">' + fmtFull(totalDeuda) + '</div>' +
    '</div>';

  // Lista: siempre las 10 categorías fijas
  lista.innerHTML = "";

  Object.keys(CATS_DEUDA).forEach(function(cat) {
    // Deudas de esta categoría
    var deudas_cat = allDeudas.filter(function(d){ return d.categoria === cat; })
      .sort(function(a,b){ return b.timestamp - a.timestamp; });

    var totalCat = porCat[cat] || 0;
    var hayDeudas = deudas_cat.length > 0;

    var card = document.createElement("div");
    card.className = "deuda-cat-card" + (totalCat > 0 ? " deuda-cat-activa" : " deuda-cat-vacia");

    // Header siempre visible
    var headerHtml =
      '<div class="deuda-cat-header">' +
        '<div class="deuda-cat-nombre">' + CATS_DEUDA[cat] + '</div>' +
        '<div class="deuda-cat-total ' + (totalCat > 0 ? "deuda-total-rojo" : "deuda-total-cero") + '">' +
          fmtFull(totalCat) +
        '</div>' +
      '</div>';

    // Detalle de items dentro de esta categoría
    var itemsHtml = "";
    if (hayDeudas) {
      deudas_cat.forEach(function(d) {
        var pct = d.montoOriginal > 0
          ? Math.round((1 - d.montoActual / d.montoOriginal) * 10)
          : 0;
        var barColor = pct >= 75 ? "var(--green)" : pct >= 40 ? "#f0a500" : "var(--red)";

        var pagosHtml = "";
        if (d.pagos && d.pagos.length) {
          pagosHtml = '<div class="deuda-pagos">' +
            d.pagos.map(function(p) {
              return '<span class="deuda-pago-chip">−' + fmtM(p.monto) + ' · ' + (p.fecha || "") + '</span>';
            }).join("") +
          '</div>';
        }

        itemsHtml +=
          '<div class="deuda-item">' +
            '<div class="deuda-item-top">' +
              '<div class="deuda-item-left">' +
                (d.descripcion ? '<div class="deuda-desc">' + d.descripcion + '</div>' : '') +
                '<div class="deuda-fecha">Registrada: ' + (d.fecha || "") + '</div>' +
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
              '<button class="deuda-btn-abonar" data-id="' + d._id + '" data-monto="' + d.montoActual + '">💳 Abonar</button>' +
              '<button class="deuda-btn-del" data-id="' + d._id + '">✕</button>' +
            '</div>' +
          '</div>';
      });
    }

    card.innerHTML = headerHtml + (itemsHtml ? '<div class="deuda-items-wrap">' + itemsHtml + '</div>' : '');
    lista.appendChild(card);
  });

  // Listeners
  lista.querySelectorAll(".deuda-btn-abonar").forEach(function(btn) {
    btn.addEventListener("click", function() {
      abonarDeuda(btn.getAttribute("data-id"), parseFloat(btn.getAttribute("data-monto")));
    });
  });
  lista.querySelectorAll(".deuda-btn-del").forEach(function(btn) {
    btn.addEventListener("click", function() {
      eliminarDeuda(btn.getAttribute("data-id"));
    });
  });
}

function initDeudas() {
  document.getElementById("btn-guardar-deuda").addEventListener("click", guardarDeuda);

  // Listener Firebase
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

// ===================== INIT =====================
function initApp() {
  // Fecha
  document.getElementById("fecha-hoy").textContent =
    new Date().toLocaleDateString("es-AR", {weekday:"long",day:"numeric",month:"long",year:"numeric"}).toUpperCase();

  // Reloj
  function tickReloj() {
    document.getElementById("reloj").textContent =
      new Date().toLocaleTimeString("es-AR", {hour:"2-digit",minute:"2-digit",second:"2-digit"});
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
  initToggleHist();
  initFirebase();
}

document.addEventListener("DOMContentLoaded", function() {
  // Chart.js defaults — evita fuente negra en modo oscuro
  if (window.Chart) {
    Chart.defaults.color = "#888";
    Chart.defaults.font.family = "Space Grotesk, sans-serif";
    Chart.defaults.font.size   = 11;
  }

  // Login gate: si ya está autenticado arranca directo, si no espera el login
  var yaAutenticado = initDashLogin();
  if (yaAutenticado) initApp();
});