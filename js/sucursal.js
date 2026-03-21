// ===================== CONSTANTES =====================
var SUCURSALES = ["NAZCA", "OLAZABAL", "CUENCA", "BEIRO", "GOYENA"];

var RUBROS_VENTAS = [
  { id: "efectivo",      label: "Efectivo" },
  { id: "debito",        label: "Débito" },
  { id: "credito",       label: "Crédito" },
  { id: "mercadopago",   label: "Mercado Pago / QR" },
  { id: "linkpago",      label: "Link de Pago" },
  { id: "transferencia", label: "Transferencia" }
];

var CATS_EG = {
  proveedores: "Proveedores",
  servicios:   "Servicios",
  alquiler:    "Alquiler",
  insumos:     "Insumos",
  retiro:      "Retiro",
  otros:       "Otros"
};

var MOTIVOS_MERMA = {
  vencimiento: "Vencimiento",
  deterioro:   "Deterioro",
  rotura:      "Rotura",
  robo:        "Faltante",
  otros:       "Otros"
};

// Objetivos default — fuera de renderObjetivoSucursal para no recrear en cada llamada
var OBJETIVOS_DEFAULT = {
  NAZCA: 36000000, OLAZABAL: 29000000, CUENCA: 30000000,
  BEIRO: 23000000, GOYENA:   26000000
};

var STORAGE_KEY       = "vvglobal_sucursal";
var AUTH_SUC_KEY      = "vvglobal_suc_auth";
var AUTH_SUC_DURACION = 8 * 60 * 60 * 1000; // 8 horas

// ===================== ESTADO =====================
var sucursalActual  = localStorage.getItem(STORAGE_KEY) || null;
var registrosHoy    = [];
var movimientosTemp = [];
var mermaTemp       = [];
var tipoMovActual   = "egreso";
var dbRef           = null;
var saldoRef        = null;
var cierreRef       = null;
var cierreAyerRef   = null; // cierre del día anterior — base del saldo efectivo
var connRef         = null; // ref para el indicador de conexión
var saldoSistema    = 0;
var saldoCierreAyer = 0;    // contado del cierre de ayer (0 si no existe)

// ===================== AUTH =====================
function sucAuthValida(nombre) {
  try {
    var raw  = localStorage.getItem(AUTH_SUC_KEY);
    if (!raw) return false;
    var data = JSON.parse(raw);
    return data.sucursal === nombre && (Date.now() - data.ts) < AUTH_SUC_DURACION;
  } catch(e) { return false; }
}

function guardarSucAuth(nombre) {
  localStorage.setItem(AUTH_SUC_KEY, JSON.stringify({ sucursal: nombre, ts: Date.now() }));
}

// ===================== HELPERS =====================
function fmt(n) {
  if (!n && n !== 0) return "$0";
  return "$" + Number(n).toLocaleString("es-AR");
}

function fmtObj(n) {
  if (!n && n !== 0) return "$0";
  if (Math.abs(n) >= 1000000) return "$" + (n / 1000000).toFixed(2) + "M";
  if (Math.abs(n) >= 1000)    return "$" + (n / 1000).toFixed(0) + "K";
  return "$" + Number(n).toLocaleString("es-AR");
}

// Antes de las 9:00 se considera que aún es el día anterior
function fechaOperativa() {
  var ahora = new Date();
  if (ahora.getHours() < 9) {
    var ayer = new Date(ahora);
    ayer.setDate(ayer.getDate() - 1);
    return ayer.toISOString().slice(0, 10);
  }
  return ahora.toISOString().slice(0, 10);
}

function showToast(msg, tipo) {
  var t = document.getElementById("toast");
  t.textContent = msg;
  t.className   = "toast show " + (tipo || "ok");
  setTimeout(function() { t.classList.remove("show"); }, 3500);
}

function setBtn(id, disabled, label) {
  var b = document.getElementById(id);
  if (!b) return;
  b.disabled    = disabled;
  b.textContent = label;
}

// ===================== PANTALLA SELECCIÓN =====================
function renderSucursales() {
  var grid = document.getElementById("sucGrid");
  grid.innerHTML = "";
  SUCURSALES.forEach(function(s) {
    var btn = document.createElement("button");
    btn.className   = "suc-btn";
    btn.textContent = s;
    btn.onclick = function() { elegirSucursal(s); };
    grid.appendChild(btn);
  });
}

function elegirSucursal(nombre) {
  if (sucAuthValida(nombre)) {
    localStorage.setItem(STORAGE_KEY, nombre);
    sucursalActual = nombre;
    mostrarCarga(nombre);
    return;
  }

  firebase.database().ref("config/claves/" + nombre).once("value")
    .then(function(snap) {
      if (!snap.exists()) {
        guardarSucAuth(nombre);
        localStorage.setItem(STORAGE_KEY, nombre);
        sucursalActual = nombre;
        mostrarCarga(nombre);
      } else {
        mostrarPantallaClave(nombre, snap.val());
      }
    })
    .catch(function() {
      localStorage.setItem(STORAGE_KEY, nombre);
      sucursalActual = nombre;
      mostrarCarga(nombre);
    });
}

function mostrarPantallaClave(nombre, claveCorrecta) {
  document.getElementById("pantalla-seleccion").classList.add("hidden");
  document.getElementById("pantalla-clave").classList.remove("hidden");
  document.getElementById("clave-suc-nombre").textContent = nombre;
  document.getElementById("clave-error").classList.add("hidden");

  // Clonar input Y botones para eliminar listeners acumulados
  var inputViejo     = document.getElementById("clave-input");
  var btnOk          = document.getElementById("btn-clave-ok");
  var btnVolver      = document.getElementById("btn-clave-volver");
  var inputNuevo     = inputViejo.cloneNode(true);
  var btnOkNuevo     = btnOk.cloneNode(true);
  var btnVolverNuevo = btnVolver.cloneNode(true);

  inputViejo.parentNode.replaceChild(inputNuevo, inputViejo);
  btnOk.parentNode.replaceChild(btnOkNuevo, btnOk);
  btnVolver.parentNode.replaceChild(btnVolverNuevo, btnVolver);
  inputNuevo.value = "";

  function verificar() {
    var ingresada = inputNuevo.value.trim();
    if (!ingresada) return;
    if (ingresada === String(claveCorrecta).trim()) {
      guardarSucAuth(nombre);
      localStorage.setItem(STORAGE_KEY, nombre);
      sucursalActual = nombre;
      document.getElementById("pantalla-clave").classList.add("hidden");
      mostrarCarga(nombre);
    } else {
      document.getElementById("clave-error").classList.remove("hidden");
      inputNuevo.value = "";
      inputNuevo.focus();
    }
  }

  btnOkNuevo.addEventListener("click", verificar);
  inputNuevo.addEventListener("keyup", function(e) { if (e.key === "Enter") verificar(); });
  btnVolverNuevo.addEventListener("click", function() {
    document.getElementById("pantalla-clave").classList.add("hidden");
    document.getElementById("pantalla-seleccion").classList.remove("hidden");
  });
  setTimeout(function() { inputNuevo.focus(); }, 100);
}

function mostrarCarga(nombre) {
  document.getElementById("pantalla-seleccion").classList.add("hidden");
  document.getElementById("pantalla-clave").classList.add("hidden");
  document.getElementById("pantalla-carga").classList.remove("hidden");
  document.getElementById("suc-badge").textContent = nombre;
  document.getElementById("fecha-hoy").textContent =
    new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Poblar select de sucursal origen en movimientos
  var sel = document.getElementById("inter-origen");
  sel.innerHTML = '<option value="">— Seleccioná —</option>';
  SUCURSALES.filter(function(s) { return s !== nombre; }).forEach(function(s) {
    var opt = document.createElement("option");
    opt.value = s; opt.textContent = s;
    sel.appendChild(opt);
  });

  limpiarTodo();
  buildVentasForm();
  conectarFirebase(nombre);
}

function limpiarTodo() {
  RUBROS_VENTAS.forEach(function(r) {
    var el = document.getElementById("v-" + r.id);
    if (el) el.value = "";
  });
  var notaV = document.getElementById("nota-ventas");
  if (notaV) notaV.value = "";

  movimientosTemp = [];
  renderMovLista();
  document.getElementById("eg-categoria").value = "";
  document.getElementById("inter-origen").value  = "";
  document.getElementById("mov-monto").value     = "";
  document.getElementById("mov-detalle").value   = "";

  mermaTemp = [];
  renderMermaLista();
  document.getElementById("merma-producto").value = "";
  document.getElementById("merma-cantidad").value = "";
  document.getElementById("merma-precio").value   = "";
  document.getElementById("merma-detalle").value  = "";
  document.getElementById("merma-total-val").textContent = "$0";

  var contado = document.getElementById("cierre-contado");
  if (contado) contado.value = "";
  var notaC = document.getElementById("cierre-nota");
  if (notaC) notaC.value = "";
  var difVal = document.getElementById("cierre-diferencia-val");
  if (difVal) difVal.textContent = "—";
}

function cambiarSucursal() {
  if (!confirm("¿Seguro que querés cambiar la sucursal?\nEsto borrará la configuración guardada.")) return;

  if (dbRef)         { dbRef.off();         dbRef         = null; }
  if (saldoRef)      { saldoRef.off();      saldoRef      = null; }
  if (cierreRef)     { cierreRef.off();     cierreRef     = null; }
  if (cierreAyerRef) { cierreAyerRef.off(); cierreAyerRef = null; }
  if (connRef)       { connRef.off();       connRef       = null; }

  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(AUTH_SUC_KEY);
  sucursalActual  = null;
  movimientosTemp = [];
  mermaTemp       = [];
  saldoSistema    = 0;

  document.getElementById("pantalla-carga").classList.add("hidden");
  document.getElementById("pantalla-seleccion").classList.remove("hidden");
  renderSucursales();
}

// ===================== TABS =====================
function initTabs() {
  document.querySelectorAll(".tab").forEach(function(tab) {
    tab.addEventListener("click", function() {
      var target = tab.getAttribute("data-tab");
      document.querySelectorAll(".tab").forEach(function(t) { t.classList.remove("active"); });
      document.querySelectorAll(".tab-panel").forEach(function(p) {
        p.classList.remove("active");
        p.classList.add("hidden");
      });
      tab.classList.add("active");
      var panel = document.getElementById("tab-" + target);
      panel.classList.remove("hidden");
      panel.classList.add("active");
    });
  });
}

// ===================== TAB: VENTAS =====================
function buildVentasForm() {
  var cont = document.getElementById("fields-ventas");
  cont.innerHTML = "";
  RUBROS_VENTAS.forEach(function(r) {
    var row = document.createElement("div");
    row.className = "field-row";
    row.innerHTML =
      '<label for="v-' + r.id + '">' + r.label + '</label>' +
      '<div class="input-wrap">' +
        '<span class="prefix">$</span>' +
        '<input type="number" id="v-' + r.id + '" min="0" step="1" placeholder="0">' +
      '</div>';
    cont.appendChild(row);
  });
}

function guardarVentas() {
  var ventas = {};
  RUBROS_VENTAS.forEach(function(r) {
    var v = parseFloat(document.getElementById("v-" + r.id).value) || 0;
    if (v > 0) ventas[r.id] = v;
  });
  var total = Object.values(ventas).reduce(function(a, b) { return a + b; }, 0);
  if (!total) { showToast("Ingresá al menos un monto de venta.", "error"); return; }

  setBtn("btn-guardar-ventas", true, "Guardando...");
  firebase.database()
    .ref("registros/" + fechaOperativa() + "/" + sucursalActual)
    .push({
      tipo:        "ventas",
      sucursal:    sucursalActual,
      fecha:       fechaOperativa(),
      timestamp:   Date.now(),
      ventas:      ventas,
      totalVentas: total,
      nota:        document.getElementById("nota-ventas").value.trim()
    })
    .then(function() {
      showToast("¡Ventas guardadas!", "ok");
      RUBROS_VENTAS.forEach(function(r) { document.getElementById("v-" + r.id).value = ""; });
      document.getElementById("nota-ventas").value = "";
    })
    .catch(function(e) { showToast("Error al guardar.", "error"); console.error(e); })
    .finally(function() { setBtn("btn-guardar-ventas", false, "Guardar Ventas"); });
}

// ===================== TAB: MOVIMIENTOS =====================
function initMovimientos() {
  document.querySelectorAll(".mov-tipo-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      document.querySelectorAll(".mov-tipo-btn").forEach(function(b) { b.classList.remove("active"); });
      btn.classList.add("active");
      tipoMovActual = btn.getAttribute("data-tipo");

      if (tipoMovActual === "egreso") {
        document.getElementById("mov-campos-egreso").classList.remove("hidden");
        document.getElementById("mov-campos-inter").classList.add("hidden");
        btn.style.background  = "var(--red-bg)";
        btn.style.borderColor = "var(--red)";
        btn.style.color       = "var(--red)";
      } else {
        document.getElementById("mov-campos-egreso").classList.add("hidden");
        document.getElementById("mov-campos-inter").classList.remove("hidden");
        btn.style.background  = "var(--blue-bg)";
        btn.style.borderColor = "var(--blue)";
        btn.style.color       = "var(--blue)";
      }
      document.querySelectorAll(".mov-tipo-btn").forEach(function(b) {
        if (!b.classList.contains("active")) {
          b.style.background  = "";
          b.style.borderColor = "";
          b.style.color       = "";
        }
      });
    });
  });

  document.getElementById("btn-add-mov").addEventListener("click", addMovimiento);
  document.getElementById("mov-detalle").addEventListener("keydown", function(e) {
    if (e.key === "Enter") addMovimiento();
  });
}

function addMovimiento() {
  var monto   = parseFloat(document.getElementById("mov-monto").value) || 0;
  var detalle = document.getElementById("mov-detalle").value.trim();
  if (!monto || monto <= 0) { showToast("Ingresá un monto mayor a cero.", "error"); return; }

  if (tipoMovActual === "egreso") {
    var cat = document.getElementById("eg-categoria").value;
    if (!cat) { showToast("Seleccioná una categoría.", "error"); return; }
    movimientosTemp.push({ tipo: "egreso", cat: cat, monto: monto, detalle: detalle });
  } else {
    var origen = document.getElementById("inter-origen").value;
    if (!origen) { showToast("Seleccioná la sucursal de origen.", "error"); return; }
    movimientosTemp.push({ tipo: "ingreso-inter", origen: origen, monto: monto, detalle: detalle });
  }

  document.getElementById("eg-categoria").value = "";
  document.getElementById("inter-origen").value  = "";
  document.getElementById("mov-monto").value     = "";
  document.getElementById("mov-detalle").value   = "";
  renderMovLista();
}

function removeMovimiento(idx) {
  movimientosTemp.splice(idx, 1);
  renderMovLista();
}

function renderMovLista() {
  var lista = document.getElementById("mov-lista");
  var empty = document.getElementById("mov-empty");
  lista.querySelectorAll(".item-chip").forEach(function(el) { el.remove(); });

  if (!movimientosTemp.length) { empty.style.display = "block"; return; }
  empty.style.display = "none";

  movimientosTemp.forEach(function(m, idx) {
    var chip    = document.createElement("div");
    var isInter = m.tipo === "ingreso-inter";
    chip.className = "item-chip " + (isInter ? "ingreso" : "egreso");
    chip.innerHTML =
      '<span class="chip-badge">' + (isInter ? "↑ " + m.origen : (CATS_EG[m.cat] || m.cat)) + '</span>' +
      '<span class="chip-det">'   + (m.detalle || "—") + '</span>' +
      '<span class="chip-val">'   + fmt(m.monto) + '</span>' +
      '<button class="chip-del" data-idx="' + idx + '">✕</button>';
    lista.appendChild(chip);
  });

  lista.querySelectorAll(".chip-del").forEach(function(btn) {
    btn.addEventListener("click", function() {
      removeMovimiento(parseInt(btn.getAttribute("data-idx")));
    });
  });
}

function guardarMovimientos() {
  if (!movimientosTemp.length) { showToast("No hay movimientos en la lista.", "error"); return; }
  setBtn("btn-guardar-mov", true, "Guardando...");

  var egresos        = {};
  var egresosDetalle = [];
  var ingresosInter  = [];
  var totalEgresos   = 0;
  var totalIngInter  = 0;
  var promesas       = [];

  movimientosTemp.forEach(function(m) {
    if (m.tipo === "egreso") {
      egresos[m.cat]  = (egresos[m.cat] || 0) + m.monto;
      totalEgresos   += m.monto;
      egresosDetalle.push({ cat: m.cat, monto: m.monto, detalle: m.detalle });
    } else {
      ingresosInter.push({ origen: m.origen, monto: m.monto, detalle: m.detalle });
      totalIngInter += m.monto;
    }
  });

  promesas.push(
    firebase.database()
      .ref("registros/" + fechaOperativa() + "/" + sucursalActual)
      .push({
        tipo:           "movimientos",
        sucursal:       sucursalActual,
        fecha:          fechaOperativa(),
        timestamp:      Date.now(),
        egresos:        egresos,
        egresosDetalle: egresosDetalle,
        ingresosInter:  ingresosInter,
        totalEgresos:   totalEgresos,
        totalIngInter:  totalIngInter
      })
  );

  ingresosInter.forEach(function(inter) {
    promesas.push(
      firebase.database()
        .ref("registros/" + fechaOperativa() + "/" + inter.origen)
        .push({
          tipo:           "movimientos",
          sucursal:       inter.origen,
          fecha:          fechaOperativa(),
          timestamp:      Date.now(),
          egresos:        { "transferencia-inter": inter.monto },
          egresosDetalle: [{ cat: "transferencia-inter", monto: inter.monto, detalle: "Transferido a " + sucursalActual + (inter.detalle ? " · " + inter.detalle : "") }],
          ingresosInter:  [],
          totalEgresos:   inter.monto,
          totalIngInter:  0,
          esEspejoInter:  true
        })
    );
  });

  Promise.all(promesas)
    .then(function() {
      showToast("¡Movimientos guardados!", "ok");
      movimientosTemp = [];
      renderMovLista();
    })
    .catch(function(e) { showToast("Error al guardar.", "error"); console.error(e); })
    .finally(function() { setBtn("btn-guardar-mov", false, "Guardar Movimientos"); });
}

// ===================== TAB: MERMA =====================
function initMerma() {
  function calcTotal() {
    var cant   = parseFloat(document.getElementById("merma-cantidad").value) || 0;
    var precio = parseFloat(document.getElementById("merma-precio").value)   || 0;
    document.getElementById("merma-total-val").textContent = fmt(cant * precio);
  }
  document.getElementById("merma-cantidad").addEventListener("input", calcTotal);
  document.getElementById("merma-precio").addEventListener("input", calcTotal);
  document.getElementById("btn-add-merma").addEventListener("click", addMerma);
  document.getElementById("merma-detalle").addEventListener("keydown", function(e) {
    if (e.key === "Enter") addMerma();
  });
}

function addMerma() {
  var producto = document.getElementById("merma-producto").value.trim();
  var cantidad = parseFloat(document.getElementById("merma-cantidad").value) || 0;
  var precio   = parseFloat(document.getElementById("merma-precio").value)   || 0;
  var motivo   = document.getElementById("merma-motivo").value;
  var detalle  = document.getElementById("merma-detalle").value.trim();

  if (!producto)                  { showToast("Ingresá el nombre del producto.", "error"); return; }
  if (!cantidad || cantidad <= 0) { showToast("Ingresá una cantidad válida.", "error");    return; }
  if (!precio   || precio   <= 0) { showToast("Ingresá el precio unitario.", "error");     return; }

  mermaTemp.push({ producto: producto, cantidad: cantidad, precio: precio, total: cantidad * precio, motivo: motivo, detalle: detalle });

  document.getElementById("merma-producto").value = "";
  document.getElementById("merma-cantidad").value = "";
  document.getElementById("merma-precio").value   = "";
  document.getElementById("merma-detalle").value  = "";
  document.getElementById("merma-total-val").textContent = "$0";
  renderMermaLista();
}

function removeMerma(idx) {
  mermaTemp.splice(idx, 1);
  renderMermaLista();
}

function renderMermaLista() {
  var lista = document.getElementById("merma-lista");
  var empty = document.getElementById("merma-empty");
  lista.querySelectorAll(".item-chip").forEach(function(el) { el.remove(); });

  if (!mermaTemp.length) { empty.style.display = "block"; return; }
  empty.style.display = "none";

  mermaTemp.forEach(function(m, idx) {
    var chip = document.createElement("div");
    chip.className = "item-chip merma";
    chip.innerHTML =
      '<span class="chip-badge">' + (MOTIVOS_MERMA[m.motivo] || m.motivo) + '</span>' +
      '<span class="chip-det">'   + m.cantidad + " × " + m.producto + (m.detalle ? " · " + m.detalle : "") + '</span>' +
      '<span class="chip-val">'   + fmt(m.total) + '</span>' +
      '<button class="chip-del" data-idx="' + idx + '">✕</button>';
    lista.appendChild(chip);
  });

  lista.querySelectorAll(".chip-del").forEach(function(btn) {
    btn.addEventListener("click", function() {
      removeMerma(parseInt(btn.getAttribute("data-idx")));
    });
  });
}

function guardarMerma() {
  if (!mermaTemp.length) { showToast("No hay ítems de merma en la lista.", "error"); return; }
  setBtn("btn-guardar-merma", true, "Guardando...");

  var totalMerma = mermaTemp.reduce(function(a, m) { return a + m.total; }, 0);
  firebase.database()
    .ref("registros/" + fechaOperativa() + "/" + sucursalActual)
    .push({
      tipo:       "merma",
      sucursal:   sucursalActual,
      fecha:      fechaOperativa(),
      timestamp:  Date.now(),
      items:      mermaTemp.slice(),
      totalMerma: totalMerma
    })
    .then(function() {
      showToast("¡Merma registrada!", "warn");
      mermaTemp = [];
      renderMermaLista();
    })
    .catch(function(e) { showToast("Error al guardar.", "error"); console.error(e); })
    .finally(function() { setBtn("btn-guardar-merma", false, "Guardar Merma"); });
}

// ===================== TAB: CIERRE DE CAJA =====================
function initCierre() {
  document.getElementById("cierre-contado").addEventListener("input", function() {
    var contado = parseFloat(this.value) || 0;
    var dif     = contado - saldoSistema;
    var el      = document.getElementById("cierre-diferencia-val");
    el.textContent = (dif >= 0 ? "+" : "") + fmt(dif);
    el.style.color = dif >= 0 ? "var(--green)" : "var(--red)";
  });
  document.getElementById("btn-guardar-cierre").addEventListener("click", guardarCierre);
}

function guardarCierre() {
  var contadoEl = document.getElementById("cierre-contado");
  if (!contadoEl.value) { showToast("Ingresá el monto contado.", "error"); return; }

  var contado    = parseFloat(contadoEl.value);
  var diferencia = contado - saldoSistema;
  var nota       = document.getElementById("cierre-nota").value.trim();

  setBtn("btn-guardar-cierre", true, "Guardando...");
  firebase.database()
    .ref("cierres/" + fechaOperativa() + "/" + sucursalActual)
    .set({
      sucursal:     sucursalActual,
      fecha:        fechaOperativa(),
      timestamp:    Date.now(),
      contado:      contado,
      saldoSistema: saldoSistema,
      diferencia:   diferencia,
      nota:         nota
    })
    .then(function() {
      showToast("¡Cierre guardado!", "ok");
      contadoEl.value = "";
      document.getElementById("cierre-nota").value = "";
    })
    .catch(function(e) { showToast("Error al guardar el cierre.", "error"); console.error(e); })
    .finally(function() { setBtn("btn-guardar-cierre", false, "🔒 Cerrar Caja"); });
}

function renderCierre(cierreSnap) {
  var yaHecho  = document.getElementById("cierre-ya-hecho");
  var formEl   = document.getElementById("cierre-form");
  var doneData = document.getElementById("cierre-done-data");

  if (cierreSnap && cierreSnap.exists()) {
    var d       = cierreSnap.val();
    var difSign = d.diferencia >= 0 ? "+" : "";
    var difColor = d.diferencia >= 0 ? "var(--green)" : "var(--red)";
    yaHecho.classList.remove("hidden");
    formEl.classList.add("hidden");
    doneData.innerHTML =
      '<div>Contado: <strong>'   + fmt(d.contado)      + '</strong></div>' +
      '<div>Sistema: <strong>'   + fmt(d.saldoSistema) + '</strong></div>' +
      '<div>Diferencia: <strong style="color:' + difColor + '">' + difSign + fmt(d.diferencia) + '</strong></div>' +
      (d.nota ? '<div style="margin-top:6px;font-style:italic;opacity:.7">' + d.nota + '</div>' : '');
  } else {
    yaHecho.classList.add("hidden");
    formEl.classList.remove("hidden");
    document.getElementById("cierre-saldo-sistema").textContent = fmt(saldoSistema);
    var contadoEl = document.getElementById("cierre-contado");
    if (contadoEl.value) {
      var dif   = (parseFloat(contadoEl.value) || 0) - saldoSistema;
      var difEl = document.getElementById("cierre-diferencia-val");
      difEl.textContent = (dif >= 0 ? "+" : "") + fmt(dif);
      difEl.style.color = dif >= 0 ? "var(--green)" : "var(--red)";
    }
  }
}

// ===================== SALDO DE EFECTIVO =====================

// Calcula los movimientos de efectivo del día operativo para esta sucursal.
// Fórmula completa: contado del cierre de ayer (saldoCierreAyer) + resultado de esta función.
// Todos los ingresos y egresos son en efectivo.
function calcularSaldoDesdeSnap(snapTotal) {
  var fecha = fechaOperativa();
  var saldo = 0;
  if (!snapTotal || !snapTotal.exists()) return saldo;

  var daySnap = snapTotal.child(fecha);
  if (!daySnap.exists()) return saldo;

  var sucSnap = daySnap.child(sucursalActual);
  if (!sucSnap.exists()) return saldo;

  sucSnap.forEach(function(regSnap) {
    var r = regSnap.val();
    if (r.tipo === "ventas") {
      saldo += (r.ventas && r.ventas.efectivo) ? r.ventas.efectivo : 0;
    } else if (r.tipo === "movimientos") {
      saldo += r.totalIngInter || 0;
      saldo -= r.totalEgresos  || 0;
    }
  });
  return saldo;
}

function actualizarSaldoBanner(saldo) {
  var banner  = document.getElementById("saldo-efectivo");
  var valEl   = document.getElementById("saldo-efectivo-val");
  var signoEl = document.getElementById("saldo-signo");
  valEl.textContent   = fmt(Math.abs(saldo));
  signoEl.textContent = saldo >= 0 ? "+" : "−";
  banner.className    = "saldo-banner " + (saldo >= 0 ? "saldo-ok" : "saldo-neg");
}

// ===================== OBJETIVO DEL MES =====================
function renderObjetivoSucursal(snapTotal) {
  var card = document.getElementById("obj-suc-card");
  if (!card || !sucursalActual) return;

  var objetivos = {};
  try {
    var saved = localStorage.getItem("vvglobal_objetivos");
    if (saved) objetivos = JSON.parse(saved);
  } catch(e) {}
  var meta = objetivos[sucursalActual] || OBJETIVOS_DEFAULT[sucursalActual] || 0;

  var mesActual = fechaOperativa().slice(0, 7);
  var acum = 0;
  if (snapTotal && snapTotal.exists()) {
    snapTotal.forEach(function(daySnap) {
      if (daySnap.key.slice(0, 7) !== mesActual) return;
      var sucSnap = daySnap.child(sucursalActual);
      if (!sucSnap.exists()) return;
      sucSnap.forEach(function(regSnap) {
        var r = regSnap.val();
        if (r.tipo === "ventas") acum += r.totalVentas  || 0;
        if (!r.tipo)             acum += r.totalIngresos || 0;
      });
    });
  }

  var pct      = meta > 0 ? Math.min((acum / meta) * 100, 100) : 0;
  var pctReal  = meta > 0 ? ((acum / meta) * 100).toFixed(1) : "0.0";
  var falta    = Math.max(meta - acum, 0);
  var barColor = pct >= 80 ? "var(--green-dk)" : pct >= 50 ? "var(--amber)" : "var(--red)";

  var hoy    = new Date();
  var ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  var transcurridos = 0, restantes = 0;
  for (var d = 1; d <= ultimo; d++) {
    if (new Date(hoy.getFullYear(), hoy.getMonth(), d).getDay() === 0) continue;
    if (d <= hoy.getDate()) transcurridos++;
    else restantes++;
  }
  var promReq  = restantes > 0 && falta > 0 ? falta / restantes : 0;
  var promReal = transcurridos > 0 ? acum / transcurridos : 0;

  document.getElementById("obj-suc-pct").textContent           = pctReal + "%";
  document.getElementById("obj-suc-pct").style.color           = barColor;
  document.getElementById("obj-suc-bar-fill").style.width      = pct + "%";
  document.getElementById("obj-suc-bar-fill").style.background = barColor;
  document.getElementById("obj-suc-acum").textContent          = fmtObj(acum);
  document.getElementById("obj-suc-meta").textContent          = "Obj: " + fmtObj(meta);

  var promEl = document.getElementById("obj-suc-prom");
  if (acum >= meta && meta > 0) {
    promEl.innerHTML = '<span style="color:var(--green-dk);font-weight:700">✓ Objetivo alcanzado</span>';
  } else if (restantes === 0) {
    promEl.innerHTML = '<span style="color:var(--red)">Sin días hábiles restantes</span>';
  } else {
    var promColor = promReq <= promReal ? "var(--green-dk)"
      : promReq <= promReal * 1.3 ? "var(--amber)" : "var(--red)";
    promEl.innerHTML =
      '<span>Req: <strong style="color:' + promColor + '">' + fmtObj(Math.ceil(promReq)) + '/día</strong></span>' +
      '<span>' + restantes + ' días · Real: ' + fmtObj(Math.round(promReal)) + '/día</span>';
  }
}

// ===================== RESUMEN DEL DÍA =====================
function renderResumen() {
  var lista = document.getElementById("resumen-lista");
  var elIng = document.getElementById("total-ing");
  var elEg  = document.getElementById("total-eg");
  var elNet = document.getElementById("total-net");

  if (!registrosHoy.length) {
    lista.innerHTML = '<div class="empty-state">Aún no hay registros para hoy.</div>';
    elIng.textContent = "$0";
    elEg.textContent  = "$0";
    elNet.textContent = "$0";
    return;
  }

  var sumVentas = 0, sumEgresos = 0, sumIngInter = 0;
  lista.innerHTML = "";

  registrosHoy.slice().reverse().forEach(function(reg) {
    var card = document.createElement("div");
    var hora = new Date(reg.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    if (reg.tipo === "ventas") {
      sumVentas += reg.totalVentas || 0;
      card.className = "reg-card";
      var chips = Object.entries(reg.ventas || {}).map(function(e) {
        var rub = RUBROS_VENTAS.find(function(r) { return r.id === e[0]; });
        return '<span class="det-item ing">' + (rub ? rub.label : e[0]) + ': ' + fmt(e[1]) + '</span>';
      }).join("");
      card.innerHTML =
        '<div class="reg-header">' +
          '<span class="reg-hora">' + hora + '</span>' +
          '<span class="reg-tipo-badge ventas">Ventas</span>' +
          (reg.nota ? '<span class="reg-nota">' + reg.nota + '</span>' : '') +
        '</div>' +
        '<div class="reg-detalles">' + chips + '</div>' +
        '<div class="reg-totales"><span class="ing-tot">+' + fmt(reg.totalVentas) + '</span></div>';

    } else if (reg.tipo === "movimientos") {
      sumEgresos  += reg.totalEgresos  || 0;
      sumIngInter += reg.totalIngInter || 0;
      card.className = "reg-card mov-card";
      var egChips = (reg.egresosDetalle || []).map(function(eg) {
        var lbl = eg.cat === "transferencia-inter" ? "→ Transferencia" : (CATS_EG[eg.cat] || eg.cat);
        return '<span class="det-item eg">' + lbl + (eg.detalle ? " · " + eg.detalle : "") + ': ' + fmt(eg.monto) + '</span>';
      }).join("");
      var intChips = (reg.ingresosInter || []).map(function(inter) {
        return '<span class="det-item inter">↑ ' + inter.origen + (inter.detalle ? " · " + inter.detalle : "") + ': ' + fmt(inter.monto) + '</span>';
      }).join("");
      var tots = "";
      if (reg.totalEgresos)  tots += '<span class="eg-tot">-'  + fmt(reg.totalEgresos)  + '</span>';
      if (reg.totalIngInter) tots += '<span class="ing-tot">+' + fmt(reg.totalIngInter) + ' (inter)</span>';
      card.innerHTML =
        '<div class="reg-header">' +
          '<span class="reg-hora">' + hora + '</span>' +
          '<span class="reg-tipo-badge movimientos">Movimientos</span>' +
        '</div>' +
        '<div class="reg-detalles">' + egChips + intChips + '</div>' +
        '<div class="reg-totales">' + tots + '</div>';

    } else if (reg.tipo === "merma") {
      card.className = "reg-card merma-card";
      var mChips = (reg.items || []).map(function(m) {
        return '<span class="det-item merm">' + m.cantidad + '× ' + m.producto + ': ' + fmt(m.total) + '</span>';
      }).join("");
      card.innerHTML =
        '<div class="reg-header">' +
          '<span class="reg-hora">' + hora + '</span>' +
          '<span class="reg-tipo-badge merma">Merma</span>' +
        '</div>' +
        '<div class="reg-detalles">' + mChips + '</div>' +
        '<div class="reg-totales"><span class="merm-tot">' + fmt(reg.totalMerma) + '</span></div>';

    } else {
      card.className = "reg-card";
      card.innerHTML = '<div class="reg-header"><span class="reg-hora">' + hora + '</span></div>';
    }

    lista.appendChild(card);
  });

  var neto = sumVentas + sumIngInter - sumEgresos;
  elIng.textContent = fmt(sumVentas);
  elEg.textContent  = fmt(sumEgresos);
  elNet.textContent = fmt(Math.abs(neto));
  elNet.style.color = neto >= 0 ? "var(--green-dk)" : "var(--red)";
  document.getElementById("neto-label").textContent = neto >= 0 ? "Neto +" : "Neto −";
}

// ===================== INDICADOR DE CONEXIÓN =====================
function initConexion() {
  var dot   = document.getElementById("conn-dot");
  var label = document.getElementById("conn-label");
  if (!dot || !label) return;

  // Desconectar listener anterior si existe
  if (connRef) { connRef.off(); connRef = null; }

  connRef = firebase.database().ref(".info/connected");
  connRef.on("value", function(snap) {
    var online    = snap.val() === true;
    dot.className = "conn-dot " + (online ? "conn-online" : "conn-offline");
    label.textContent = online ? "en línea" : "sin conexión";
    label.className   = "conn-label " + (online ? "conn-label-online" : "conn-label-offline");
  });
}

// ===================== FIREBASE =====================
function conectarFirebase(sucursal) {
  if (dbRef)         { dbRef.off();         dbRef         = null; }
  if (saldoRef)      { saldoRef.off();      saldoRef      = null; }
  if (cierreRef)     { cierreRef.off();     cierreRef     = null; }
  if (cierreAyerRef) { cierreAyerRef.off(); cierreAyerRef = null; }
  if (connRef)       { connRef.off();       connRef       = null; }

  try {
    // Registros de hoy — resumen del día
    dbRef = firebase.database().ref("registros/" + fechaOperativa() + "/" + sucursal);
    dbRef.on("value", function(snap) {
      registrosHoy = [];
      if (snap.exists()) {
        snap.forEach(function(child) {
          registrosHoy.push(Object.assign({ id: child.key }, child.val()));
        });
      }
      registrosHoy = registrosHoy.filter(function(r) { return !r.esEspejoInter; });
      renderResumen();
    }, function(err) {
      console.error("Firebase error:", err);
      document.getElementById("firebase-error").style.display = "block";
      document.getElementById("resumen-lista").innerHTML = '<div class="empty-state">Sin conexión a Firebase.</div>';
    });

    // Saldo histórico + objetivo
    saldoRef = firebase.database().ref("registros");
    saldoRef.on("value", function(snapTotal) {
      saldoSistema = saldoCierreAyer + calcularSaldoDesdeSnap(snapTotal);
      actualizarSaldoBanner(saldoSistema);
      var sistemaEl = document.getElementById("cierre-saldo-sistema");
      if (sistemaEl) sistemaEl.textContent = fmt(saldoSistema);
      renderObjetivoSucursal(snapTotal);
    });

    // Cierre del día anterior — base del saldo efectivo
    // Calcula la fecha de ayer respecto al día operativo
    var fechaOp   = fechaOperativa();
    var dOp       = new Date(fechaOp + "T12:00:00");
    var dAyer     = new Date(dOp);
    dAyer.setDate(dAyer.getDate() - 1);
    var fechaAyer = dAyer.toISOString().slice(0, 10);

    cierreAyerRef = firebase.database().ref("cierres/" + fechaAyer + "/" + sucursal);
    cierreAyerRef.on("value", function(snap) {
      saldoCierreAyer = (snap.exists() && snap.val().contado != null)
        ? snap.val().contado
        : 0;
      // Recalcular saldo total con la nueva base
      // saldoRef ya tiene el snap, pero necesitamos volver a disparar el cálculo.
      // Lo más simple: leer registros una vez para recalcular sincrónicamente.
      firebase.database().ref("registros").once("value", function(snapTotal) {
        saldoSistema = saldoCierreAyer + calcularSaldoDesdeSnap(snapTotal);
        actualizarSaldoBanner(saldoSistema);
        var sistemaEl = document.getElementById("cierre-saldo-sistema");
        if (sistemaEl) sistemaEl.textContent = fmt(saldoSistema);
      });
    });

    // Cierre de hoy
    cierreRef = firebase.database().ref("cierres/" + fechaOperativa() + "/" + sucursal);
    cierreRef.on("value", function(snap) { renderCierre(snap); });

    // Indicador de conexión
    initConexion();

  } catch(e) {
    console.error(e);
    document.getElementById("firebase-error").style.display = "block";
  }
}

// ===================== INIT =====================
document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("btn-cambiar").addEventListener("click", cambiarSucursal);
  document.getElementById("btn-guardar-ventas").addEventListener("click", guardarVentas);
  document.getElementById("btn-guardar-mov").addEventListener("click", guardarMovimientos);
  document.getElementById("btn-guardar-merma").addEventListener("click", guardarMerma);

  initTabs();
  initMovimientos();
  initMerma();
  initCierre();

  if (sucursalActual) {
    elegirSucursal(sucursalActual);
  } else {
    renderSucursales();
  }
});