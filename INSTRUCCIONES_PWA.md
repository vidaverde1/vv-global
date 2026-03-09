# VV Global — Instrucciones de instalación como PWA

## Estructura final de archivos

```
vv-global/
├── sucursal.html
├── sucursal.css
├── sucursal.js
├── dashboard.html
├── dashboard.css
├── dashboard.js
├── manifest.json
├── sw.js
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## Paso 1 — Subir a GitHub Pages (5 minutos)

1. Entrá a https://github.com y creá una cuenta si no tenés
2. Clic en **"New repository"** (botón verde arriba a la derecha)
3. Nombre: `vv-global` — dejalo en **Public** — clic en **Create repository**
4. En la página del repo vacío, clic en **"uploading an existing file"**
5. **Arrastrá toda la carpeta** `vv-global` (o seleccioná todos los archivos)
   - Importante: subir también la carpeta `icons/` con los dos PNG
6. Clic en **"Commit changes"**
7. Ir a **Settings → Pages** (en el menú lateral izquierdo)
8. En "Branch" seleccioná `main` → carpeta `/ (root)` → clic en **Save**
9. Esperar 1-2 minutos → te aparece la URL:
   `https://TU-USUARIO.github.io/vv-global/`

---

## Paso 2 — Instalar como app en cada PC (Windows/Chrome)

1. Abrí Chrome y entrá a:
   `https://TU-USUARIO.github.io/vv-global/sucursal.html`
2. En la barra de direcciones aparece un ícono de **instalar** (pantalla con flecha)
   — o bien: menú de Chrome (⋮) → **"Instalar VV Global"**
3. Clic en **Instalar**
4. La app aparece en el escritorio y en el menú inicio
5. Al abrirla, se abre sin barra del navegador, como una app nativa

### Para el dashboard:
Repetir desde `https://TU-USUARIO.github.io/vv-global/dashboard.html`

---

## Paso 3 — Instalar en celular (Android/iOS)

**Android (Chrome):**
- Abrí la URL → aparece banner "Agregar a pantalla de inicio" → Instalar

**iPhone (Safari):**
- Abrí la URL en Safari → botón compartir (cuadrado con flecha) → "Agregar a pantalla de inicio"

---

## Para actualizar los archivos en el futuro

1. Entrá al repo en GitHub
2. Clic en el archivo que querés actualizar
3. Clic en el ícono del lápiz (editar) → pegá el nuevo contenido → Commit
4. Los cambios se publican solos en 1-2 minutos
5. Los usuarios ven la versión nueva la próxima vez que abren la app

---

## Nota sobre Firebase

Las credenciales de Firebase quedan visibles en el código fuente público de GitHub.
Para uso interno entre sucursales esto no representa un riesgo real, ya que:
- Las reglas de Firebase controlan quién puede leer/escribir
- No hay datos sensibles de clientes expuestos
- Si en el futuro querés protegerlo, se pueden agregar reglas de autenticación

