// ---- CONSTANTES ----
var SUCURSALES = ["NAZCA", "OLAZABAL", "CUENCA", "BEIRO", "GOYENA"];
var COLORS = {
  NAZCA:    "#e8a838",
  OLAZABAL: "#3a8fd4",
  CUENCA:   "#5cc98a",
  BEIRO:    "#d45a5a",
  GOYENA:   "#9b6bd4"
};

// ---- ESTADO ----
var allData   = {};
var charts    = {};
var mesActual = new Date().toISOString().slice(0, 7);

// ---- HELPERS ----
function today() { return new Date().toISOString().slice(0, 10); }

function fmtM(n) {
  if (!n) return "$0";
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(2) + "M";
  return "$" + (n / 1000).toFixed(0) + "K";
}

function sumSuc(fecha, suc, campo) {
  var regs = (allData[fecha] && allData[fecha][suc]) ? allData[fecha][suc] : [];
  return regs.reduce(function(acc, r) { return acc + (r[campo] || 0); }, 0);
}

function diasDelMes(mes) {
  return Object.keys(allData).filter(function(f) { return f.indexOf(mes) === 0; }).sort();
}

// ---- RENDER PRINCIPAL ----
function renderTodo() {
  renderHoy();
  renderUltimosRegistros();
  renderCharts();
}

function renderHoy() {
  var fecha = today();
  var totalGlobalIng = 0, totalGlobalEg = 0;

  SUCURSALES.forEach(function(suc) {
    var ing = sumSuc(fecha, suc, "totalIngresos");
    var eg  = sumSuc(fecha, suc, "totalEgresos");
    totalGlobalIng += ing;
    totalGlobalEg  += eg;

    document.getElementById("kpi-ing-"  + suc).textContent = fmtM(ing);
    document.getElementById("kpi-eg-"   + suc).textContent = fmtM(eg);
    document.getElementById("kpi-net-"  + suc).textContent = fmtM(ing - eg);
    document.getElementById("kpi-net-"  + suc).style.color = ing - eg >= 0 ? "var(--green)" : "var(--red)";

    var regs = (allData[fecha] && allData[fecha][suc]) ? allData[fecha][suc] : [];
    document.getElementById("kpi-regs-" + suc).textContent = regs.length + (regs.length === 1 ? " carga" : " cargas");
  });

  document.getElementById("global-ing").textContent = fmtM(totalGlobalIng);
  document.getElementById("global-eg").textContent  = fmtM(totalGlobalEg);
  document.getElementById("global-net").textContent = fmtM(totalGlobalIng - totalGlobalEg);
  document.getElementById("global-net").style.color =
    totalGlobalIng - totalGlobalEg >= 0 ? "var(--green)" : "var(--red)";
}

function renderUltimosRegistros() {
  var container = document.getElementById("ultimos-regs");
  var todos = [];

  Object.keys(allData).forEach(function(fecha) {
    Object.keys(allData[fecha]).forEach(function(suc) {
      allData[fecha][suc].forEach(function(r) {
        todos.push(Object.assign({}, r, { fecha: fecha }));
      });
    });
  });

  todos.sort(function(a, b) { return b.timestamp - a.timestamp; });
  var ultimos = todos.slice(0, 12);

  if (ultimos.length === 0) {
    container.innerHTML = '<div class="empty-st">No hay registros aún.</div>';
    return;
  }

  container.innerHTML = "";
  ultimos.forEach(function(r) {
    var ts    = new Date(r.timestamp);
    var hora  = ts.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    var fecha = ts.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
    var color = COLORS[r.sucursal] || "#888";

    var div = document.createElement("div");
    div.className = "feed-item";
    div.innerHTML =
      '<div class="feed-suc" style="background:' + color + '20;color:' + color + '">' + r.sucursal + "</div>" +
      '<div class="feed-info">' +
        '<span class="feed-time">' + fecha + " " + hora + "</span>" +
        (r.nota ? '<span class="feed-nota">' + r.nota + "</span>" : "") +
      "</div>" +
      '<div class="feed-nums">' +
        '<span class="feed-ing">+' + fmtM(r.totalIngresos || 0) + "</span>" +
        '<span class="feed-eg">-'  + fmtM(r.totalEgresos  || 0) + "</span>" +
      "</div>";
    container.appendChild(div);
  });
}

function renderCharts() {
  var dias = diasDelMes(mesActual);
  if (dias.length === 0) return;

  var labels = dias.map(function(d) { return d.slice(8); });

  var tooltipBase = {
    backgroundColor: "#1a1714",
    borderColor:     "#ddd9d0",
    borderWidth:     1,
    titleColor:      "#f5f2eb",
    bodyColor:       "#8a8178"
  };

  var scalesBase = {
    x: { ticks: { color: "#aaa49a", font: { size: 10 } }, grid: { color: "#e8e4de" } },
    y: { ticks: { color: "#aaa49a", font: { size: 10 }, callback: function(v) { return fmtM(v); } }, grid: { color: "#e8e4de" } }
  };

  // Línea: evolución ingresos
  var datasets = SUCURSALES.map(function(suc) {
    return {
      label:                suc,
      data:                 dias.map(function(f) { return sumSuc(f, suc, "totalIngresos"); }),
      borderColor:          COLORS[suc],
      backgroundColor:      COLORS[suc] + "25",
      borderWidth:          2.5,
      pointRadius:          3,
      pointBackgroundColor: COLORS[suc],
      fill:                 false,
      tension:              0.3
    };
  });

  if (charts.linea) charts.linea.destroy();
  charts.linea = new Chart(document.getElementById("chart-linea"), {
    type: "line",
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#8a8178", font: { size: 11, family: "Syne" }, boxWidth: 10 } },
        tooltip: tooltipBase
      },
      scales: scalesBase
    }
  });

  // Barras: total por sucursal en el mes
  var totMesData = SUCURSALES.map(function(suc) {
    return dias.reduce(function(acc, f) { return acc + sumSuc(f, suc, "totalIngresos"); }, 0);
  });

  if (charts.barras) charts.barras.destroy();
  charts.barras = new Chart(document.getElementById("chart-barras"), {
    type: "bar",
    data: {
      labels: SUCURSALES,
      datasets: [{
        label:           "Ingresos del mes",
        data:            totMesData,
        backgroundColor: SUCURSALES.map(function(s) { return COLORS[s]; }),
        borderRadius:    6,
        borderSkipped:   false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#8a8178", font: { size: 11, family: "Syne" }, boxWidth: 10 } },
        tooltip: tooltipBase
      },
      scales: scalesBase
    }
  });

  // Donut: participación
  if (charts.donut) charts.donut.destroy();
  charts.donut = new Chart(document.getElementById("chart-donut"), {
    type: "doughnut",
    data: {
      labels: SUCURSALES,
      datasets: [{
        data:            totMesData,
        backgroundColor: SUCURSALES.map(function(s) { return COLORS[s]; }),
        borderColor:     "#fff",
        borderWidth:     3,
        hoverOffset:     6
      }]
    },
    options: {
      cutout: "65%",
      plugins: {
        legend: { position: "bottom", labels: { color: "#8a8178", font: { size: 11 }, boxWidth: 10, padding: 10 } },
        tooltip: {
          backgroundColor: "#1a1714",
          callbacks: {
            label: function(ctx) {
              var total = ctx.dataset.data.reduce(function(a, b) { return a + b; }, 0);
              return " " + ctx.label + ": " + (total > 0 ? (ctx.raw / total * 100).toFixed(1) : 0) + "%";
            }
          }
        }
      }
    }
  });
}

// ---- FIREBASE ----
function initListener() {
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
    renderTodo();
  });
}

// ---- INIT ----
document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("fecha-hoy").textContent =
    new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  document.getElementById("mes-label").textContent =
    new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" }).toUpperCase();

  setInterval(function() {
    document.getElementById("reloj").textContent =
      new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }, 1000);

  initListener();
});
