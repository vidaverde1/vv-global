/* Fuerza formato DD/MM/AAAA en todos los input[type=date] (Safari/Mac ignora lang) */
(function () {
  function isoAVisible(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
    var p = iso.split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
  }
  function visibleAIso(s) {
    var m = String(s == null ? "" : s).trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (!m) return "";
    var d = +m[1], mo = +m[2], y = +m[3], dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return "";
    return y + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  }
  function upgrade(input) {
    if (input.dataset.fechaUpg) return;
    input.dataset.fechaUpg = "1";
    var crudo = input.value || input.getAttribute("value") || "";
    input.type = "text";
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("placeholder", "DD/MM/AAAA");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("maxlength", "10");
    var iso = /^\d{4}-\d{2}-\d{2}$/.test(crudo) ? crudo : visibleAIso(crudo);
    var proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    Object.defineProperty(input, "value", {
      configurable: true,
      get: function () { return iso; },
      set: function (v) {
        iso = /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : visibleAIso(v);
        proto.set.call(input, isoAVisible(iso));
      }
    });
    input.value = iso;
    var isoAlFoco = iso;
    input.addEventListener("focus", function () { isoAlFoco = iso; });
    input.addEventListener("input", function () {
      var texto = proto.get.call(input);
      var digitos = texto.replace(/\D/g, "").slice(0, 8);
      var formateado;
      if (digitos.length > 4) formateado = digitos.slice(0, 2) + "/" + digitos.slice(2, 4) + "/" + digitos.slice(4);
      else if (digitos.length > 2) formateado = digitos.slice(0, 2) + "/" + digitos.slice(2);
      else formateado = digitos;
      if (formateado !== texto) {
        proto.set.call(input, formateado);
        try { input.setSelectionRange(formateado.length, formateado.length); } catch (e) {}
      }
      iso = visibleAIso(formateado);
    });
    input.addEventListener("blur", function () {
      iso = visibleAIso(proto.get.call(input));
      proto.set.call(input, isoAVisible(iso));
      if (iso !== isoAlFoco) {
        isoAlFoco = iso;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }
  function scan(root) {
    (root.querySelectorAll ? root.querySelectorAll('input[type="date"]') : []).forEach(upgrade);
    if (root.nodeType === 1 && root.matches && root.matches('input[type="date"]')) upgrade(root);
  }
  function init() {
    scan(document);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
