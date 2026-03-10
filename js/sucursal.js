// ===================== CONSTANTES =====================
var SUCURSALES = ["NAZCA", "OLAZABAL", "CUENCA", "BEIRO", "GOYENA"];

var RUBROS_VENTAS = [
  { id: "efectivo",      label: "Efectivo" },
  { id: "debito",        label: "Débito" },
  { id: "credito",       label: "Crédito" },
  { id: "transferencia", label: "Transferencia" },
  { id: "mercadopago",   label: "Mercado Pago / QR" }
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
  robo:        "Robo / faltante",
  otros:       "Otros"
};

var STORAGE_KEY = "vvglobal_sucursal";

// ===================== ESTADO =====================
var sucursalActual = localStorage.getItem(STORAGE_KEY) || null;
var registrosHoy   = [];
var movimientosTemp = [];   // lista acumulada movimientos
var mermaTemp       = [];   // lista acumulada merma
var tipoMovActual   = "egreso";
var dbRef           = null;

// ===================== HELPERS =====================
function fmt(n) {
  if (!n && n !== 0) return "$0";
  return "$" + Number(n).toLocaleString("es-AR");
}
function today() { return new Date().toISOString().slice(0, 10); }

function showToast(msg, tipo) {
  var t = document.getElementById("toast");
  t.textContent = msg;
  t.className   = "toast show " + (tipo || "ok");
  setTimeout(function() { t.classList.remove("show"); }, 3500);
}

function setBtn(id, disabled, label) {
  var b = document.getElementById(id);
  b.disabled    = disabled;
  b.textContent = label;
}

// ===================== PANTALLA SELECCIÓN =====================
function renderSucursales() {
  var grid = document.getElementById("sucGrid");
  grid.innerHTML = "";
  SUCURSALES.forEach(function(s) {
    var btn = document.createElement("button");
    btn.className = "suc-btn";
    btn.textContent = s;
    btn.onclick = function() { elegirSucursal(s); };
    grid.appendChild(btn);
  });
}

function elegirSucursal(nombre) {
  localStorage.setItem(STORAGE_KEY, nombre);
  sucursalActual = nombre;
  mostrarCarga(nombre);
}

function mostrarCarga(nombre) {
  document.getElementById("pantalla-seleccion").classList.add("hidden");
  document.getElementById("pantalla-carga").classList.remove("hidden");
  document.getElementById("suc-badge").textContent  = nombre;
  document.getElementById("fecha-hoy").textContent  =
    new Date().toLocaleDateString("es-AR", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

  // Poblar select de sucursales origen (todas menos la propia)
  var sel = document.getElementById("inter-origen");
  sel.innerHTML = '<option value="">— Seleccioná —</option>';
  SUCURSALES.filter(function(s) { return s !== nombre; }).forEach(function(s) {
    var opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });

  buildVentasForm();
  conectarFirebase(nombre);
}

function cambiarSucursal() {
  if (!confirm("¿Seguro que querés cambiar la sucursal?\nEsto borrará la configuración guardada.")) return;
  if (dbRef) dbRef.off();
  localStorage.removeItem(STORAGE_KEY);
  sucursalActual  = null;
  movimientosTemp = [];
  mermaTemp       = [];
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
      document.querySelectorAll(".tab-panel").forEach(function(p) { p.classList.remove("active"); p.classList.add("hidden"); });
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
  var total = Object.values(ventas).reduce(function(a,b){return a+b;}, 0);

  if (!total) { showToast("Ingresá al menos un monto de venta.", "error"); return; }

  setBtn("btn-guardar-ventas", true, "Guardando...");

  var registro = {
    tipo:        "ventas",
    sucursal:    sucursalActual,
    fecha:       today(),
    timestamp:   Date.now(),
    ventas:      ventas,
    totalVentas: total,
    nota:        document.getElementById("nota-ventas").value.trim()
  };

  firebase.database()
    .ref("registros/" + today() + "/" + sucursalActual)
    .push(registro)
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
  // Toggle tipo
  document.querySelectorAll(".mov-tipo-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      document.querySelectorAll(".mov-tipo-btn").forEach(function(b) { b.classList.remove("active"); });
      btn.classList.add("active");
      tipoMovActual = btn.getAttribute("data-tipo");

      if (tipoMovActual === "egreso") {
        document.getElementById("mov-campos-egreso").classList.remove("hidden");
        document.getElementById("mov-campos-inter").classList.add("hidden");
        // color del botón activo
        btn.style.background = "var(--red-bg)";
        btn.style.borderColor = "var(--red)";
        btn.style.color = "var(--red)";
      } else {
        document.getElementById("mov-campos-egreso").classList.add("hidden");
        document.getElementById("mov-campos-inter").classList.remove("hidden");
        btn.style.background = "var(--blue-bg)";
        btn.style.borderColor = "var(--blue)";
        btn.style.color = "var(--blue)";
      }
      // resetear el otro botón
      document.querySelectorAll(".mov-tipo-btn").forEach(function(b) {
        if (!b.classList.contains("active")) {
          b.style.background = "";
          b.style.borderColor = "";
          b.style.color = "";
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

    var badge = isInter
      ? "↑ " + m.origen
      : (CATS_EG[m.cat] || m.cat);

    chip.innerHTML =
      '<span class="chip-badge">' + badge + '</span>' +
      '<span class="chip-det">'   + (m.detalle || "—") + '</span>' +
      '<span class="chip-val">'   + fmt(m.monto) + '</span>' +
      '<button class="chip-del" data-idx="' + idx + '">✕</button>';
    lista.appendChild(chip);
  });

  lista.querySelectorAll(".chip-del").forEach(function(btn) {
    btn.addEventListener("click", function() { removeMovimiento(parseInt(btn.getAttribute("data-idx"))); });
  });
}

function guardarMovimientos() {
  if (!movimientosTemp.length) { showToast("No hay movimientos en la lista.", "error"); return; }

  setBtn("btn-guardar-mov", true, "Guardando...");

  var egresos         = {};
  var egresosDetalle  = [];
  var ingresosInter   = [];
  var totalEgresos    = 0;
  var totalIngInter   = 0;
  var promesas        = [];

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

  var registro = {
    tipo:           "movimientos",
    sucursal:       sucursalActual,
    fecha:          today(),
    timestamp:      Date.now(),
    egresos:        egresos,
    egresosDetalle: egresosDetalle,
    ingresosInter:  ingresosInter,
    totalEgresos:   totalEgresos,
    totalIngInter:  totalIngInter
  };

  // Guardar el registro principal en la sucursal actual
  var pMain = firebase.database()
    .ref("registros/" + today() + "/" + sucursalActual)
    .push(registro);
  promesas.push(pMain);

  // Para cada ingreso inter-sucursal, registrar el egreso espejo en la sucursal origen
  ingresosInter.forEach(function(inter) {
    var espejo = {
      tipo:           "movimientos",
      sucursal:       inter.origen,
      fecha:          today(),
      timestamp:      Date.now(),
      egresos:        { "transferencia-inter": inter.monto },
      egresosDetalle: [{ cat: "transferencia-inter", monto: inter.monto, detalle: "Transferido a " + sucursalActual + (inter.detalle ? " · " + inter.detalle : "") }],
      ingresosInter:  [],
      totalEgresos:   inter.monto,
      totalIngInter:  0,
      esEspejoInter:  true
    };
    var pEspejo = firebase.database()
      .ref("registros/" + today() + "/" + inter.origen)
      .push(espejo);
    promesas.push(pEspejo);
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
  // Calcular total en tiempo real
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

  if (!producto) { showToast("Ingresá el nombre del producto.", "error"); return; }
  if (!cantidad || cantidad <= 0) { showToast("Ingresá una cantidad válida.", "error"); return; }
  if (!precio || precio <= 0)   { showToast("Ingresá el precio unitario.", "error"); return; }

  mermaTemp.push({
    producto: producto,
    cantidad: cantidad,
    precio:   precio,
    total:    cantidad * precio,
    motivo:   motivo,
    detalle:  detalle
  });

  document.getElementById("merma-producto").value  = "";
  document.getElementById("merma-cantidad").value  = "";
  document.getElementById("merma-precio").value    = "";
  document.getElementById("merma-detalle").value   = "";
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
    var label = m.cantidad + " × " + m.producto;
    chip.innerHTML =
      '<span class="chip-badge">' + (MOTIVOS_MERMA[m.motivo] || m.motivo) + '</span>' +
      '<span class="chip-det">'   + label + (m.detalle ? " · " + m.detalle : "") + '</span>' +
      '<span class="chip-val">'   + fmt(m.total) + '</span>' +
      '<button class="chip-del" data-idx="' + idx + '">✕</button>';
    lista.appendChild(chip);
  });

  lista.querySelectorAll(".chip-del").forEach(function(btn) {
    btn.addEventListener("click", function() { removeMerma(parseInt(btn.getAttribute("data-idx"))); });
  });
}

function guardarMerma() {
  if (!mermaTemp.length) { showToast("No hay ítems de merma en la lista.", "error"); return; }

  setBtn("btn-guardar-merma", true, "Guardando...");

  var totalMerma = mermaTemp.reduce(function(a, m) { return a + m.total; }, 0);

  var registro = {
    tipo:        "merma",
    sucursal:    sucursalActual,
    fecha:       today(),
    timestamp:   Date.now(),
    items:       mermaTemp.slice(),
    totalMerma:  totalMerma
  };

  firebase.database()
    .ref("registros/" + today() + "/" + sucursalActual)
    .push(registro)
    .then(function() {
      showToast("¡Merma registrada!", "warn");
      mermaTemp = [];
      renderMermaLista();
    })
    .catch(function(e) { showToast("Error al guardar.", "error"); console.error(e); })
    .finally(function() { setBtn("btn-guardar-merma", false, "Guardar Merma"); });
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
    var hora = new Date(reg.timestamp).toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" });

    if (reg.tipo === "ventas") {
      sumVentas += reg.totalVentas || 0;
      card.className = "reg-card";
      var chips = Object.entries(reg.ventas || {}).map(function(e) {
        var rub = RUBROS_VENTAS.find(function(r){return r.id===e[0];});
        return '<span class="det-item ing">' + (rub?rub.label:e[0]) + ': ' + fmt(e[1]) + '</span>';
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
        return '<span class="det-item eg">' + lbl + (eg.detalle?" · "+eg.detalle:"") + ': ' + fmt(eg.monto) + '</span>';
      }).join("");

      var intChips = (reg.ingresosInter || []).map(function(inter) {
        return '<span class="det-item inter">↑ ' + inter.origen + (inter.detalle?" · "+inter.detalle:"") + ': ' + fmt(inter.monto) + '</span>';
      }).join("");

      var tots = "";
      if (reg.totalEgresos)  tots += '<span class="eg-tot">-' + fmt(reg.totalEgresos)  + '</span>';
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
      // Registro viejo (formato anterior) — mostrar genérico
      card.className = "reg-card";
      card.innerHTML = '<div class="reg-header"><span class="reg-hora">' + hora + '</span></div>';
    }

    lista.appendChild(card);
  });

  // Neto: ventas + ingresosInter - egresos
  var neto = sumVentas + sumIngInter - sumEgresos;
  elIng.textContent = fmt(sumVentas);
  elEg.textContent  = fmt(sumEgresos);
  elNet.textContent = fmt(Math.abs(neto));
  elNet.style.color = neto >= 0 ? "var(--green-dk)" : "var(--red)";
  document.getElementById("neto-label").textContent = neto >= 0 ? "Neto +" : "Neto −";
}

// ===================== FIREBASE =====================
function conectarFirebase(sucursal) {
  try {
    dbRef = firebase.database().ref("registros/" + today() + "/" + sucursal);
    dbRef.on("value", function(snap) {
      registrosHoy = [];
      if (snap.exists()) {
        snap.forEach(function(child) {
          registrosHoy.push(Object.assign({ id: child.key }, child.val()));
        });
      }
      // Filtrar registros espejo (que son egresos registrados automáticamente en la sucursal origen)
      registrosHoy = registrosHoy.filter(function(r) { return !r.esEspejoInter; });
      renderResumen();
    }, function(err) {
      console.error("Firebase error:", err);
      document.getElementById("firebase-error").style.display = "block";
      document.getElementById("resumen-lista").innerHTML =
        '<div class="empty-state">Sin conexión a Firebase.</div>';
    });
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

  if (sucursalActual) {
    mostrarCarga(sucursalActual);
  } else {
    renderSucursales();
  }
});