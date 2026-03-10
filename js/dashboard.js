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
  { id: "otros",       label: "Otros" }
];

// Objetivos default (se sobreescriben con localStorage)
var OBJETIVOS_DEFAULT = {
  NAZCA: 36000000, OLAZABAL: 29000000, CUENCA: 30000000,
  BEIRO: 23000000, GOYENA: 26000000
};

// ===================== ESTADO =====================
var allData    = {};
var charts     = {};
var sectionActual = "home";
var periodMedios  = "hoy";
var periodEgresos = "hoy";
var periodHist    = "semana";

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

function sumField(fecha, suc, campo) {
  var regs = (allData[fecha] && allData[fecha][suc]) ? allData[fecha][suc] : [];
  return regs.reduce(function(a, r) { return a + (r[campo] || 0); }, 0);
}

function sumRubro(fecha, suc, tipo, rubroId) {
  var regs = (allData[fecha] && allData[fecha][suc]) ? allData[fecha][suc] : [];
  return regs.reduce(function(a, r) {
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

  var titles = { home:"Dashboard", objetivos:"Objetivos", medios:"Medios de Pago", egresos:"Egresos", merma:"Merma", historial:"Historial" };
  document.getElementById("section-title").textContent = titles[sec] || sec;

  // Renderizar la sección al entrar
  if (sec === "objetivos")  renderObjetivos();
  if (sec === "medios")     renderMedios(periodMedios);
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
    div.innerHTML =
      '<div class="feed-suc" style="background:' + c + '20;color:' + c + '">' + r.sucursal + '</div>' +
      '<div class="feed-info">' +
        '<span class="feed-time">' + fdia + ' ' + hora + '</span>' +
        (r.nota ? '<span class="feed-nota">' + r.nota + '</span>' : '') +
      '</div>' +
      '<div class="feed-nums">' +
        '<span class="feed-ing">+' + fmtM(r.totalIngresos||0) + '</span>' +
        '<span class="feed-eg">-'  + fmtM(r.totalEgresos||0)  + '</span>' +
      '</div>';
    container.appendChild(div);
  });
}

function renderChartsHome() {
  var mes  = mesActual();
  var dias = diasDeMes(mes);

  document.getElementById("mes-label-home").textContent =
    new Date().toLocaleDateString("es-AR", {month:"long",year:"numeric"}).toUpperCase();

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

    if (charts.barras) charts.barras.destroy();
    charts.barras = new Chart(document.getElementById("chart-barras"), {
      type:"bar",
      data:{labels:SUCURSALES,datasets:[{label:"Ingresos mes",data:totMes,backgroundColor:SUCURSALES.map(function(s){return COLORS[s];}),borderRadius:5,borderSkipped:false}]},
      options:{responsive:true,plugins:{legend:{display:false},tooltip:tooltipBase},scales:scalesBase}
    });

    if (charts.donut) charts.donut.destroy();
    charts.donut = new Chart(document.getElementById("chart-donut"), {
      type:"doughnut",
      data:{labels:SUCURSALES,datasets:[{data:totMes,backgroundColor:SUCURSALES.map(function(s){return COLORS[s];}),borderColor:"#111",borderWidth:3,hoverOffset:6}]},
      options:{cutout:"65%",plugins:{legend:{position:"bottom",labels:{color:"#666",font:{size:10},boxWidth:8,padding:8}},tooltip:{backgroundColor:"#1a1a1a",callbacks:{label:function(ctx){var t=ctx.dataset.data.reduce(function(a,b){return a+b;},0);return " "+ctx.label+": "+(t>0?(ctx.raw/t*100).toFixed(1):0)+"%";}}}}}
    });
  }
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

  btnCancel.addEventListener("click", function() { modal.classList.add("hidden"); });

  btnSave.addEventListener("click", function() {
    var obj = {};
    SUCURSALES.forEach(function(suc) {
      var val = parseFloat(document.getElementById("obj-inp-" + suc).value) || 0;
      obj[suc] = val;
    });
    localStorage.setItem("vvglobal_objetivos", JSON.stringify(obj));
    modal.classList.add("hidden");
    renderObjetivos();
  });
}

// ===================== SECCIÓN: MEDIOS DE PAGO =====================
function renderMedios(period) {
  periodMedios = period;
  var fechas = period === "hoy" ? [today()] : diasDeMes(mesActual());

  // Totales globales por rubro
  var totales = {};
  RUBROS_ING.forEach(function(r) { totales[r.id] = 0; });
  fechas.forEach(function(f) {
    SUCURSALES.forEach(function(suc) {
      RUBROS_ING.forEach(function(r) {
        totales[r.id] += sumRubro(f, suc, "ingresos", r.id);
      });
    });
  });

  var labels = RUBROS_ING.map(function(r){return r.label;});
  var data   = RUBROS_ING.map(function(r){return totales[r.id];});
  var colors = ["#f0a500","#4da6ff","#00e676","#ff6b6b","#c084fc"];

  if (charts.mediosDonut) charts.mediosDonut.destroy();
  charts.mediosDonut = new Chart(document.getElementById("chart-medios-donut"), {
    type:"doughnut",
    data:{labels:labels,datasets:[{data:data,backgroundColor:colors,borderColor:"#111",borderWidth:3,hoverOffset:6}]},
    options:{cutout:"60%",plugins:{legend:{position:"bottom",labels:{color:"#666",font:{size:10},boxWidth:8,padding:8}},tooltip:{backgroundColor:"#1a1a1a",callbacks:{label:function(ctx){var t=ctx.dataset.data.reduce(function(a,b){return a+b;},0);return " "+ctx.label+": "+(t>0?(ctx.raw/t*100).toFixed(1):0)+"%  "+fmtM(ctx.raw);}}}}}
  });

  // Detalle por sucursal
  var cont = document.getElementById("medios-detalle");
  cont.innerHTML = "";
  SUCURSALES.forEach(function(suc) {
    var suctot = fechas.reduce(function(a,f){return a+sumField(f,suc,"totalIngresos");},0);
    if (!suctot) return;
    var card = document.createElement("div");
    card.className = "detalle-suc-card";
    var html = '<div class="detalle-suc-title">' + suc + '</div>';
    RUBROS_ING.forEach(function(r) {
      var val = fechas.reduce(function(a,f){return a+sumRubro(f,suc,"ingresos",r.id);},0);
      if (!val) return;
      var pct = suctot > 0 ? (val/suctot*100) : 0;
      html +=
        '<div class="detalle-row">' +
          '<span class="detalle-row-label">' + r.label + '</span>' +
          '<div class="detalle-row-right">' +
            '<div class="detalle-mini-bar-bg"><div class="detalle-mini-bar-fill" style="width:' + pct + '%"></div></div>' +
            '<span class="detalle-row-val">' + fmtM(val) + '</span>' +
          '</div>' +
        '</div>';
    });
    card.innerHTML = html;
    cont.appendChild(card);
  });
}

function initToggleMedios() {
  document.getElementById("toggle-medios").addEventListener("click", function(e) {
    var btn = e.target.closest(".toggle-btn");
    if (!btn) return;
    document.querySelectorAll("#toggle-medios .toggle-btn").forEach(function(b){b.classList.remove("active");});
    btn.classList.add("active");
    renderMedios(btn.getAttribute("data-val"));
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
    type:"doughnut",
    data:{labels:labels,datasets:[{data:data,backgroundColor:colors,borderColor:"#111",borderWidth:3,hoverOffset:6}]},
    options:{cutout:"60%",plugins:{legend:{position:"bottom",labels:{color:"#666",font:{size:10},boxWidth:8,padding:8}},tooltip:{backgroundColor:"#1a1a1a",callbacks:{label:function(ctx){var t=ctx.dataset.data.reduce(function(a,b){return a+b;},0);return " "+ctx.label+": "+(t>0?(ctx.raw/t*100).toFixed(1):0)+"%  "+fmtM(ctx.raw);}}}}}
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

  // Acumulado vs objetivo
  var obj = getObjetivos();
  var vsObj = document.getElementById("hist-vs-obj");
  vsObj.innerHTML = "";

  var mesFechas = period === "anterior" ? diasDeMes(mesAnt) : diasDeMes(mes);
  SUCURSALES.forEach(function(suc) {
    var acum = mesFechas.reduce(function(a,f){return a+sumField(f,suc,"totalIngresos");},0);
    var meta = obj[suc] || 0;
    var pct  = meta > 0 ? Math.min((acum/meta)*100,100) : 0;
    var pctReal = meta > 0 ? ((acum/meta)*100).toFixed(1) : "0.0";
    var barColor = pct>=80?"var(--green)":pct>=50?"#f0a500":"var(--red)";
    var card = document.createElement("div");
    card.className = "hist-vs-card";
    card.innerHTML =
      '<div class="hist-vs-top">' +
        '<span class="hist-vs-suc">' + suc + '</span>' +
        '<span class="hist-vs-pct" style="color:' + barColor + '">' + pctReal + '%</span>' +
      '</div>' +
      '<div class="hist-bar-bg"><div class="hist-bar-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div>' +
      '<div class="hist-vs-nums">' +
        '<span>' + fmtFull(acum) + '</span>' +
        '<span>/ ' + fmtFull(meta) + '</span>' +
      '</div>';
    vsObj.appendChild(card);
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

// ===================== FIREBASE =====================
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
    // Re-renderizar la sección activa
    renderHome();
    if (sectionActual === "objetivos") renderObjetivos();
    if (sectionActual === "medios")    renderMedios(periodMedios);
    if (sectionActual === "egresos")   renderEgresos(periodEgresos);
    if (sectionActual === "merma")     renderMerma();
    if (sectionActual === "historial") renderHistorial(periodHist);
  });
}

// ===================== INIT =====================
document.addEventListener("DOMContentLoaded", function() {
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
  initToggleMedios();
  initToggleEgresos();
  initToggleHist();
  initFirebase();
});