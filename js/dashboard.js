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
  { id: "transferencia", label: "Transferencia" },
  { id: "mercadopago",   label: "Mercado Pago / QR" }
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

// ===================== ESTADO =====================
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

  var titles = { home:"Dashboard", objetivos:"Objetivos", facturas:"Facturas", egresos:"Egresos", merma:"Merma", historial:"Historial" };
  document.getElementById("section-title").textContent = titles[sec] || sec;

  if (sec === "objetivos")  renderObjetivos();
  if (sec === "facturas")   renderFacturas();
  if (sec === "egresos")    renderEgresos(periodEgresos);
  if (sec === "merma")      renderMerma();
  if (sec === "historial")  renderHistorial(periodHist);
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
          '<span class="obj-prom-label">Promedio requerido / día hábil</span>' +
          '<span class="obj-prom-val" style="color:' + promColor + '">' + fmtFull(Math.ceil(promReq)) + '</span>' +
        '</div>' +
        '<div class="obj-prom-sub">' +
          '<span>' + habil.restantes + ' días hábiles restantes</span>' +
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
    // Pedir clave del dashboard
    var clave = prompt("Ingresá la clave de administrador:");
    if (!clave) return;
    firebase.database().ref("config/claves/dashboard").once("value")
      .then(function(snap) {
        var ok = !snap.exists() || String(clave).trim() === String(snap.val()).trim();
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
      if (!confirm("¿Eliminar esta factura?")) return;
      firebase.database().ref("facturas/" + id).remove();
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
  btn.disabled = true; btn.textContent = "Guardando...";

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
    document.getElementById("fact-fecha").value     = "";
    document.getElementById("fact-monto").value     = "";
  })
  .catch(function(e){ alert("Error al guardar: " + e.message); })
  .finally(function(){ btn.disabled = false; btn.textContent = "+ Cargar Factura"; });
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

// ===================== EFECTIVO POR SUCURSAL =====================
function renderEfectivoTabla(snapTotal) {
  var tbody = document.getElementById("efectivo-tbody");
  if (!tbody) return;

  // Calcular saldo de efectivo para cada sucursal
  var saldos = {};
  SUCURSALES.forEach(function(s){ saldos[s] = 0; });

  if (snapTotal && snapTotal.exists()) {
    snapTotal.forEach(function(daySnap) {
      daySnap.forEach(function(sucSnap) {
        var suc = sucSnap.key;
        if (!saldos.hasOwnProperty(suc)) return;
        sucSnap.forEach(function(regSnap) {
          var r = regSnap.val();
          if (r.esEspejoInter) return;
          if (r.tipo === "ventas") {
            saldos[suc] += (r.ventas && r.ventas["efectivo"]) ? r.ventas["efectivo"] : 0;
          } else if (r.tipo === "movimientos") {
            (r.ingresosInter || []).forEach(function(i){ saldos[suc] += i.monto || 0; });
            saldos[suc] -= r.totalEgresos || 0;
          } else if (!r.tipo) {
            saldos[suc] += (r.ingresos && r.ingresos["efectivo"]) ? r.ingresos["efectivo"] : 0;
            saldos[suc] -= r.totalEgresos || 0;
          }
        });
      });
    });
  }

  // Máximo absoluto para la barra proporcional
  var maxAbs = Math.max(1, Math.max.apply(null, SUCURSALES.map(function(s){ return Math.abs(saldos[s]); })));

  tbody.innerHTML = "";
  SUCURSALES.forEach(function(suc) {
    var saldo = saldos[suc];
    var pct   = Math.round(Math.abs(saldo) / maxAbs * 100);
    var color = COLORS[suc];
    var esPos = saldo >= 0;
    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td><span class="ef-suc" style="color:' + color + '">' + suc + '</span></td>' +
      '<td><span class="ef-estado">' + (esPos ? "✓ positivo" : "⚠ negativo") + '</span></td>' +
      '<td class="ef-bar-cell"><div class="ef-bar-wrap"><div class="ef-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div></td>' +
      '<td><span class="ef-val ' + (esPos ? "positivo" : "negativo") + '">' + (esPos ? "+" : "−") + fmtM(Math.abs(saldo)) + '</span></td>';
    tbody.appendChild(tr);
  });
}


function renderCierreStrip() {
  var cont = document.getElementById("cierre-strip-home");
  if (!cont) return;
  cont.innerHTML = '<div class="empty-st" style="padding:12px 0;font-size:.78rem">Cargando cierres...</div>';

  firebase.database().ref("cierres/" + today()).once("value", function(snap) {
    cont.innerHTML = "";
    SUCURSALES.forEach(function(suc) {
      var card = document.createElement("div");
      card.className = "cierre-dash-card";
      card.setAttribute("data-suc", suc);
      var c = COLORS[suc];

      if (snap.exists() && snap.child(suc).exists()) {
        var d        = snap.child(suc).val();
        var difSign  = d.diferencia >= 0 ? "+" : "−";
        var difColor = d.diferencia >= 0 ? "var(--green)" : "var(--red)";
        var hora     = new Date(d.timestamp).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
        card.classList.add("cierre-ok");
        card.innerHTML =
          '<div class="cs-suc" style="color:' + c + '">' + suc + '</div>' +
          '<div class="cs-estado cs-cerrado">✓ Cerrado ' + hora + '</div>' +
          '<div class="cs-row"><span class="cs-lbl">Contado</span><span class="cs-val">' + fmtM(d.contado) + '</span></div>' +
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

// ===================== INIT =====================
document.addEventListener("DOMContentLoaded", function() {
  // Chart.js defaults — evita fuente negra en modo oscuro
  if (window.Chart) {
    Chart.defaults.color = "#888";
    Chart.defaults.font.family = "Space Grotesk, sans-serif";
    Chart.defaults.font.size   = 11;
  }

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
  initToggleParticipacion();
  initToggleEgresos();
  initToggleHist();
  initFirebase();
});