# Seguridad — VV Global

## Estado actual (importante)

Hoy la validación de claves ocurre **en el cliente**: el navegador lee
`config/claves/{SUCURSAL}` y compara el texto. Con la base abierta, cualquiera
que conozca la URL puede leer y escribir todos los datos.

El código ahora intenta, de forma **no bloqueante** (`signInAnonymously`), iniciar
sesión anónima. Esto **solo** sirve como filtro básico una vez que apliques las
reglas de abajo y habilites Anonymous Auth. No reemplaza una autenticación real.

## Paso 1 — Baseline (rápido, sin romper la app)

1. Firebase Console → **Authentication → Sign-in method → Anonymous**: *habilitar*.
2. Realtime Database → **Reglas**: pegar el contenido de `database.rules.json` y publicar.

Con `auth != null`, el acceso requiere que el cliente haya iniciado sesión (lo hace
automáticamente al cargar la app). Bloquea bots/scrapers y escrituras anónimas.

> Si deshabilitás Anonymous Auth con estas reglas activas, la app deja de funcionar.

## Paso 2 — Autenticación real (recomendado)

La clave en texto plano en `config/claves` no puede protegerse con reglas.
Migración recomendada:

1. Crear un usuario de Firebase Auth por sucursal (email/password) o usar
   **Custom Claims** con un rol (`sucursal`, `dashboard`, `admin`).
2. Reemplazar la pantalla de clave por login con `firebase.auth()`.
3. Reglas por rol, p. ej.:

```json
{
  "rules": {
    "registros": {
      "$fecha": {
        "$sucursal": {
          ".read": "auth != null",
          ".write": "auth != null && (auth.token.admin === true || auth.token.sucursal === $sucursal)"
        }
      }
    },
    "config": {
      "claves": { ".read": false, ".write": false },
      "objetivos": { ".write": "auth != null && auth.token.admin === true" }
    }
  }
}
```

4. Eliminar `config/claves` de la base.

## Notas

- La `apiKey` de `config.js` es pública por diseño (identifica el proyecto); el
  control de acceso real son las **reglas** + **Auth**.
- Rotá las claves de `config/claves` si el repo estuvo expuesto.
