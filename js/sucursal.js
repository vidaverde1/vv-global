// ---- CONSTANTES ----
const SUCURSALES = ["NAZCA", "OLAZABAL", "CUENCA", "BEIRO", "GOYENA"];
const RUBROS = {
  ingresos: [
    { id: "efectivo",      label: "Efectivo" },
    { id: "debito",        label: "Débito" },
    { id: "credito",       label: "Crédito" },
    { id: "transferencia", label: "Transferencia" },
    { id: "mercadopago",   label: "Mercado Pago / QR" },
  ],
  egresos: [
    { id: "proveedores", label: "Pago a Proveedores" },
    { id: "insumos",     label: "Gastos de Insumos" },
    { id: "alquiler",    label: "Alquiler" },
    { id: "servicios",   label: "Servicios (luz, gas, etc.)" },
    { id: "otros",       label: "Otros Egresos" },
  ]
};
const STORAGE_KEY = "vvglobal_sucursal";

// ---- ESTADO ----
let sucursalActual = localStorage.getItem(STORAGE_KEY) || null;
let registrosHoy   = [];
let dbRef          = null;

// ---- HELPERS ----
function fmt(n) { return n ? "$" + Number(n).toLocaleString("es-AR") : "$0"; }
function today() { return new Date().toISOString().slice(0, 10); }

function showToast(msg, tipo) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show " + tipo;
  setTimeout(() => t.classList.remove("show"), 3500);
}

// ---- PANTALLA SELECCIÓN ----
function renderSucursales() {
  const grid = document.getElementById("sucGrid");
  grid.innerHTML = "";
  SUCURSALES.forEach(function(s) {
    const btn = document.createElement("button");
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
  document.getElementById("suc-nombre").textContent = nombre;
  document.getElementById("suc-tag").textContent    = nombre;
  document.getElementById("fecha-hoy").textContent  =
    new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  buildForm();
  conectarFirebase(nombre);
}

function cambiarSucursal() {
  if (!confirm("¿Seguro que querés cambiar la sucursal de esta PC?\nEsto borrará la configuración guardada.")) return;
  if (dbRef) dbRef.off();
  localStorage.removeItem(STORAGE_KEY);
  sucursalActual = null;
  document.getElementById("pantalla-carga").classList.add("hidden");
  document.getElementById("pantalla-seleccion").classList.remove("hidden");
  renderSucursales();
}

// ---- FORMULARIO ----
function buildForm() {
  ["ingresos", "egresos"].forEach(function(tipo) {
    const container = document.getElementById("fields-" + tipo);
    container.innerHTML = "";
    RUBROS[tipo].forEach(function(r) {
      const row = document.createElement("div");
      row.className = "field-row";
      row.innerHTML =
        '<label for="f-' + r.id + '">' + r.label + '</label>' +
        '<div class="input-wrap">' +
          '<span class="prefix">$</span>' +
          '<input type="number" id="f-' + r.id + '" min="0" step="1" placeholder="0">' +
        '</div>';
      container.appendChild(row);
    });
  });
}

function resetForm() {
  document.querySelectorAll(".field-row input").forEach(function(i) { i.value = ""; });
  document.getElementById("nota").value = "";
}

function guardar() {
  var ingresos = {}, egresos = {};
  RUBROS.ingresos.forEach(function(r) {
    var v = parseFloat(document.getElementById("f-" + r.id).value) || 0;
    if (v > 0) ingresos[r.id] = v;
  });
  RUBROS.egresos.forEach(function(r) {
    var v = parseFloat(document.getElementById("f-" + r.id).value) || 0;
    if (v > 0) egresos[r.id] = v;
  });

  var totalIngresos = Object.values(ingresos).reduce(function(a, b) { return a + b; }, 0);
  var totalEgresos  = Object.values(egresos).reduce(function(a, b) { return a + b; }, 0);

  if (!totalIngresos && !totalEgresos) {
    showToast("Ingresá al menos un valor mayor a cero.", "error");
    return;
  }

  var btn = document.getElementById("btn-guardar");
  btn.disabled    = true;
  btn.textContent = "Guardando...";

  var registro = {
    sucursal:      sucursalActual,
    fecha:         today(),
    timestamp:     Date.now(),
    ingresos:      ingresos,
    egresos:       egresos,
    totalIngresos: totalIngresos,
    totalEgresos:  totalEgresos,
    nota:          document.getElementById("nota").value.trim()
  };

  firebase.database()
    .ref("registros/" + today() + "/" + sucursalActual)
    .push(registro)
    .then(function() {
      showToast("¡Registro guardado!", "ok");
      resetForm();
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

// ---- RESUMEN DEL DÍA ----
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

    var hora = new Date(reg.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    var ingDet = Object.entries(reg.ingresos || {}).map(function(entry) {
      var k = entry[0], v = entry[1];
      var rubro = RUBROS.ingresos.find(function(r) { return r.id === k; });
      return '<span class="det-item ing">' + (rubro ? rubro.label : k) + ": " + fmt(v) + "</span>";
    }).join("");

    var egDet = Object.entries(reg.egresos || {}).map(function(entry) {
      var k = entry[0], v = entry[1];
      var rubro = RUBROS.egresos.find(function(r) { return r.id === k; });
      return '<span class="det-item eg">' + (rubro ? rubro.label : k) + ": " + fmt(v) + "</span>";
    }).join("");

    var card = document.createElement("div");
    card.className = "reg-card";
    card.innerHTML =
      '<div class="reg-header">' +
        '<span class="reg-hora">' + hora + "</span>" +
        (reg.nota ? '<span class="reg-nota">' + reg.nota + "</span>" : "") +
      "</div>" +
      '<div class="reg-detalles">' + ingDet + egDet + "</div>" +
      '<div class="reg-totales">' +
        '<span class="ing-tot">+' + fmt(reg.totalIngresos) + "</span>" +
        '<span class="eg-tot">-'  + fmt(reg.totalEgresos)  + "</span>" +
      "</div>";
    lista.appendChild(card);
  });

  elIng.textContent = fmt(sumIng);
  elEg.textContent  = fmt(sumEg);
  var neto = sumIng - sumEg;
  elNet.textContent = fmt(Math.abs(neto));
  elNet.style.color = neto >= 0 ? "var(--green)" : "var(--red)";
  document.getElementById("neto-label").textContent = neto >= 0 ? "Neto Positivo" : "Neto Negativo";
}

// ---- FIREBASE ----
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
    }, function(error) {
      console.error("Firebase error:", error);
      document.getElementById("firebase-error").style.display = "block";
      document.getElementById("resumen-lista").innerHTML =
        '<div class="empty-state">Sin conexión a Firebase.</div>';
    });
  } catch(e) {
    console.error("Firebase init error:", e);
    document.getElementById("firebase-error").style.display = "block";
  }
}

// ---- INIT ----
document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("btn-guardar").addEventListener("click", guardar);
  document.getElementById("btn-cambiar").addEventListener("click", cambiarSucursal);

  if (sucursalActual) {
    mostrarCarga(sucursalActual);
  } else {
    renderSucursales();
  }
});
