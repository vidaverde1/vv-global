// ===================== CONSTANTES =====================
var SUCURSALES = ["NAZCA", "OLAZABAL", "CUENCA", "BEIRO", "GOYENA"];

var RUBROS_ING = [
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

var STORAGE_KEY = "vvglobal_sucursal";

// ===================== ESTADO =====================
var sucursalActual = localStorage.getItem(STORAGE_KEY) || null;
var registrosHoy   = [];
var egresosTemp    = [];   // lista acumulada antes de guardar
var dbRef          = null;

// ===================== HELPERS =====================
function fmt(n) {
  if (!n && n !== 0) return "$0";
  return "$" + Number(n).toLocaleString("es-AR");
}

function today() { return new Date().toISOString().slice(0, 10); }

function showToast(msg, tipo) {
  var t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show " + tipo;
  setTimeout(function() { t.classList.remove("show"); }, 3500);
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
  document.getElementById("suc-nombre").textContent  = nombre;
  document.getElementById("suc-badge").textContent   = nombre;
  document.getElementById("fecha-hoy").textContent   =
    new Date().toLocaleDateString("es-AR", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  buildIngresosForm();
  conectarFirebase(nombre);
}

function cambiarSucursal() {
  if (!confirm("¿Seguro que querés cambiar la sucursal de esta PC?\nEsto borrará la configuración guardada.")) return;
  if (dbRef) dbRef.off();
  localStorage.removeItem(STORAGE_KEY);
  sucursalActual = null;
  egresosTemp    = [];
  document.getElementById("pantalla-carga").classList.add("hidden");
  document.getElementById("pantalla-seleccion").classList.remove("hidden");
  renderSucursales();
}

// ===================== FORMULARIO INGRESOS =====================
function buildIngresosForm() {
  var cont = document.getElementById("fields-ingresos");
  cont.innerHTML = "";
  RUBROS_ING.forEach(function(r) {
    var row = document.createElement("div");
    row.className = "field-row";
    row.innerHTML =
      '<label for="f-' + r.id + '">' + r.label + '</label>' +
      '<div class="input-wrap">' +
        '<span class="prefix">$</span>' +
        '<input type="number" id="f-' + r.id + '" min="0" step="1" placeholder="0">' +
      '</div>';
    cont.appendChild(row);
  });
}

function resetIngresosForm() {
  RUBROS_ING.forEach(function(r) {
    var el = document.getElementById("f-" + r.id);
    if (el) el.value = "";
  });
  document.getElementById("nota").value = "";
}

// ===================== EGRESOS ACUMULADOR =====================
function initEgresosAdder() {
  document.getElementById("btn-add-egreso").addEventListener("click", addEgreso);
  // Enter en el campo detalle también agrega
  document.getElementById("eg-detalle").addEventListener("keydown", function(e) {
    if (e.key === "Enter") addEgreso();
  });
}

function addEgreso() {
  var cat    = document.getElementById("eg-categoria").value;
  var monto  = parseFloat(document.getElementById("eg-monto").value) || 0;
  var detalle = document.getElementById("eg-detalle").value.trim();

  if (!cat) { showToast("Seleccioná una categoría.", "error"); return; }
  if (!monto || monto <= 0) { showToast("Ingresá un monto mayor a cero.", "error"); return; }

  egresosTemp.push({ cat: cat, monto: monto, detalle: detalle });

  // Resetear campos del adder
  document.getElementById("eg-categoria").value = "";
  document.getElementById("eg-monto").value     = "";
  document.getElementById("eg-detalle").value   = "";
  document.getElementById("eg-monto").focus();

  renderEgresosLista();
}

function removeEgreso(idx) {
  egresosTemp.splice(idx, 1);
  renderEgresosLista();
}

function renderEgresosLista() {
  var lista = document.getElementById("egresos-lista");
  var empty = document.getElementById("egresos-empty");

  // Limpiar ítems anteriores (conservar el empty)
  var items = lista.querySelectorAll(".egreso-item");
  items.forEach(function(el) { el.remove(); });

  if (!egresosTemp.length) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  egresosTemp.forEach(function(eg, idx) {
    var item = document.createElement("div");
    item.className = "egreso-item";
    item.innerHTML =
      '<span class="egreso-item-cat">' + (CATS_EG[eg.cat] || eg.cat) + '</span>' +
      '<span class="egreso-item-det">' + (eg.detalle || "—") + '</span>' +
      '<span class="egreso-item-monto">' + fmt(eg.monto) + '</span>' +
      '<button class="egreso-item-del" data-idx="' + idx + '" title="Eliminar">✕</button>';
    lista.appendChild(item);
  });

  // Eventos de eliminar
  lista.querySelectorAll(".egreso-item-del").forEach(function(btn) {
    btn.addEventListener("click", function() {
      removeEgreso(parseInt(btn.getAttribute("data-idx")));
    });
  });
}

// ===================== GUARDAR REGISTRO =====================
function guardar() {
  // Recolectar ingresos
  var ingresos = {};
  RUBROS_ING.forEach(function(r) {
    var v = parseFloat(document.getElementById("f-" + r.id).value) || 0;
    if (v > 0) ingresos[r.id] = v;
  });

  var totalIngresos = Object.values(ingresos).reduce(function(a, b) { return a + b; }, 0);

  // Recolectar egresos desde la lista acumulada
  var egresos = {};
  var egresosDetalle = [];
  egresosTemp.forEach(function(eg) {
    egresos[eg.cat] = (egresos[eg.cat] || 0) + eg.monto;
    egresosDetalle.push({ cat: eg.cat, monto: eg.monto, detalle: eg.detalle });
  });
  var totalEgresos = Object.values(egresos).reduce(function(a, b) { return a + b; }, 0);

  if (!totalIngresos && !totalEgresos) {
    showToast("No hay ingresos ni egresos cargados.", "error");
    return;
  }

  var btn = document.getElementById("btn-guardar");
  btn.disabled    = true;
  btn.textContent = "Guardando...";

  var registro = {
    sucursal:       sucursalActual,
    fecha:          today(),
    timestamp:      Date.now(),
    ingresos:       ingresos,
    egresos:        egresos,
    egresosDetalle: egresosDetalle,
    totalIngresos:  totalIngresos,
    totalEgresos:   totalEgresos,
    nota:           document.getElementById("nota").value.trim()
  };

  firebase.database()
    .ref("registros/" + today() + "/" + sucursalActual)
    .push(registro)
    .then(function() {
      showToast("¡Registro guardado!", "ok");
      resetIngresosForm();
      egresosTemp = [];
      renderEgresosLista();
    })
    .catch(function(e) {
      showToast("Error al guardar. Revisá la conexión.", "error");
      console.error(e);
    })
    .finally(function() {
      btn.disabled    = false;
      btn.textContent = "Guardar Registro";
    });
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

  var sumIng = 0, sumEg = 0;
  lista.innerHTML = "";

  registrosHoy.slice().reverse().forEach(function(reg) {
    sumIng += reg.totalIngresos || 0;
    sumEg  += reg.totalEgresos  || 0;

    var hora = new Date(reg.timestamp).toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" });

    // Ingresos: chips por rubro
    var ingDet = Object.entries(reg.ingresos || {}).map(function(e) {
      var k = e[0], v = e[1];
      var rub = RUBROS_ING.find(function(r) { return r.id === k; });
      return '<span class="det-item ing">' + (rub ? rub.label : k) + ': ' + fmt(v) + '</span>';
    }).join("");

    // Egresos: usar egresosDetalle si existe, sino fallback a egresos agrupados
    var egDet = "";
    if (reg.egresosDetalle && reg.egresosDetalle.length) {
      egDet = reg.egresosDetalle.map(function(eg) {
        var label = CATS_EG[eg.cat] || eg.cat;
        return '<span class="det-item eg">' + label + (eg.detalle ? ' · ' + eg.detalle : '') + ': ' + fmt(eg.monto) + '</span>';
      }).join("");
    } else {
      egDet = Object.entries(reg.egresos || {}).map(function(e) {
        var k = e[0], v = e[1];
        return '<span class="det-item eg">' + (CATS_EG[k] || k) + ': ' + fmt(v) + '</span>';
      }).join("");
    }

    var card = document.createElement("div");
    card.className = "reg-card";
    card.innerHTML =
      '<div class="reg-header">' +
        '<span class="reg-hora">' + hora + '</span>' +
        (reg.nota ? '<span class="reg-nota">' + reg.nota + '</span>' : '') +
      '</div>' +
      '<div class="reg-detalles">' + ingDet + egDet + '</div>' +
      '<div class="reg-totales">' +
        '<span class="ing-tot">+' + fmt(reg.totalIngresos) + '</span>' +
        '<span class="eg-tot">-'  + fmt(reg.totalEgresos)  + '</span>' +
      '</div>';
    lista.appendChild(card);
  });

  elIng.textContent = fmt(sumIng);
  elEg.textContent  = fmt(sumEg);

  var neto = sumIng - sumEg;
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
      renderResumen();
    }, function(err) {
      console.error("Firebase error:", err);
      document.getElementById("firebase-error").style.display = "block";
      document.getElementById("resumen-lista").innerHTML =
        '<div class="empty-state">Sin conexión a Firebase.</div>';
    });
  } catch(e) {
    console.error("Firebase init error:", e);
    document.getElementById("firebase-error").style.display = "block";
  }
}

// ===================== INIT =====================
document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("btn-guardar").addEventListener("click", guardar);
  document.getElementById("btn-cambiar").addEventListener("click", cambiarSucursal);
  initEgresosAdder();

  if (sucursalActual) {
    mostrarCarga(sucursalActual);
  } else {
    renderSucursales();
  }
});