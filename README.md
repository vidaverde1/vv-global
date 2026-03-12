# VV Global — Sistema de Gestión de Sucursales

Sistema interno de carga y seguimiento de ventas, movimientos y merma para las 5 sucursales de VV Global. Construido como PWA instalable, con sincronización en tiempo real via Firebase.

---

## 📱 Apps

El sistema tiene dos aplicaciones independientes, cada una instalable como PWA:

| App | URL | Descripción |
|-----|-----|-------------|
| **Sucursal** | `/sucursal.html` | Carga diaria de datos por sucursal |
| **Dashboard** | `/dashboard.html` | Vista global para administración |

---

## ✨ Funcionalidades

### App de Sucursal
- 🔐 Autenticación por clave individual por sucursal (guardada 8hs en el dispositivo)
- 💰 **Ventas** — registro por medio de cobro (efectivo, débito, crédito, transferencia, Mercado Pago)
- ↕ **Movimientos** — egresos por categoría e ingresos inter-sucursal con registro espejo automático
- 📦 **Merma** — productos con cantidad, precio unitario, motivo y detalle
- 🔒 **Cierre de caja** — monto contado vs saldo del sistema, con diferencia calculada (1 vez por día)
- 💵 Saldo de efectivo acumulado histórico en tiempo real

### Dashboard
- 📊 KPIs globales del día y evolución mensual con gráficos (Chart.js)
- 🎯 Objetivos mensuales por sucursal con promedio diario requerido (días hábiles lunes-sábado)
- 💳 Desglose de medios de pago — hoy / mes
- 📉 Análisis de egresos por categoría — hoy / mes
- 🗑 Seguimiento de merma mensual por sucursal
- 📅 Historial comparativo — semana / mes actual / mes anterior
- 🔒 Estado de cierre de caja por sucursal
- 💵 Efectivo disponible por sucursal (acumulado histórico)
- 🔐 Clave de administrador para editar objetivos

---

## 🗂 Estructura

```
vv-global/
├── sucursal.html
├── dashboard.html
├── config.js              ← credenciales Firebase (no se sube al repo)
├── config.example.js      ← plantilla de configuración
├── manifest-sucursal.json
├── manifest-dashboard.json
├── styles/
│   ├── sucursal.css
│   └── dashboard.css
├── js/
│   ├── sucursal.js
│   ├── dashboard.js
│   └── sw.js              ← Service Worker PWA
└── icons/
    ├── icon-sucursal-192.png
    ├── icon-sucursal-512.png
    ├── icon-dashboard-192.png
    └── icon-dashboard-512.png
```

---

## 🔥 Estructura de datos en Firebase

```
registros/
  {YYYY-MM-DD}/
    {SUCURSAL}/
      {pushId}/
        tipo: "ventas" | "movimientos" | "merma"

cierres/
  {YYYY-MM-DD}/
    {SUCURSAL}/
      contado, saldoSistema, diferencia, nota, timestamp

config/
  claves/
    {SUCURSAL}: "clave"
    dashboard:  "clave-admin"
```

---

## ⚙️ Setup

**1.** Clonar el repo y crear `config.js` a partir de la plantilla:
```bash
cp config.example.js config.js
```

**2.** Completar `config.js` con las credenciales del proyecto Firebase.

**3.** Configurar las claves de acceso en Firebase Console:
```
Realtime Database → config/claves/
  NAZCA:     "clave"
  OLAZABAL:  "clave"
  CUENCA:    "clave"
  BEIRO:     "clave"
  GOYENA:    "clave"
  dashboard: "clave-admin"
```

**4.** Configurar las reglas de seguridad en Firebase Console → Realtime Database → Reglas para restringir escritura y proteger `config/claves`.

---

## 🛠 Stack

- **Frontend:** HTML + CSS + JavaScript vanilla
- **Base de datos:** Firebase Realtime Database
- **Gráficos:** Chart.js
- **Hosting:** GitHub Pages
- **PWA:** Service Worker + Web App Manifest

---

## 🏪 Sucursales

`NAZCA` · `OLAZABAL` · `CUENCA` · `BEIRO` · `GOYENA`