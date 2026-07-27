# 🛺 El Dayli-cio

App de control diario de recaudación para la flota de triciclos eléctricos de la familia. Cualquier familiar puede registrar cada día si un vehículo trabajó y cuánto recaudó; si algún vehículo se queda sin registrar, la app manda un correo de recordatorio automático por la noche especificando cuál.

## Qué incluye

- **Backend:** Node.js + Express
- **Base de datos:** SQLite nativo de Node (`node:sqlite`) — no requiere compilar nada, cero problemas de permisos en Windows. Los datos se guardan en un archivo `.db` que **nunca se borra** salvo que tú lo borres.
- **Correos automáticos:** Nodemailer, con lista de destinatarios configurable desde la propia app. El correo lista exactamente qué vehículo(s) faltan por registrar ese día.
- **Multi-vehículo:** agrega tantos triciclos/vehículos como tenga el negocio, cada uno con su propio registro diario.
- **Registro familiar compartido:** el registro es **por vehículo, no por persona** — un solo registro por vehículo y día, que cualquier familiar puede llenar o corregir. El nombre de quién registró se guarda solo como dato informativo, sin contraseñas.
- **Frontend:** HTML/CSS/JS sin frameworks, con un medidor animado tipo tablero y tarjetas de estado por vehículo.

## Cómo funciona el registro compartido

- Cada **vehículo** tiene como máximo un registro por día (monto, si trabajó, notas).
- Cualquier familiar puede entrar y llenar el registro de cualquier vehículo. Si dos familiares registran el mismo vehículo el mismo día, el segundo **corrige** el dato del primero — no se duplica.
- El selector "Quién registra" es opcional y solo queda guardado como referencia de quién hizo la última actualización.
- Por la noche, la app revisa vehículo por vehículo. Si el Triciclo A ya se registró pero el Triciclo B no, el correo avisa específicamente que falta el Triciclo B.

## 1. Instalación local (VS Code)

```bash
npm install
copy .env.example .env
```

Abre el archivo `.env` y complétalo (ver sección de correo abajo). Luego:

```bash
npm start
```

Abre `http://localhost:3000` en el navegador. La primera vez, ve a la sección **Configuración** al final de la página y agrega tus usuarios y los correos que deben recibir el recordatorio.

> Nota: verás un aviso `ExperimentalWarning: SQLite is an experimental feature`. Es normal — es información de Node, no un error. La API de `node:sqlite` es estable para este uso.

## 2. Configurar el envío de correos (Gmail)

1. Activa la verificación en 2 pasos en tu cuenta de Gmail: https://myaccount.google.com/security
2. Genera una "Contraseña de aplicación": https://myaccount.google.com/apppasswords
3. En tu `.env`:
   ```
   SMTP_USER=tu_correo@gmail.com
   SMTP_PASS=la_contraseña_de_16_caracteres_generada
   ```
4. **No uses tu contraseña normal de Gmail** — Google la rechaza para este tipo de conexión.

Si dejas `SMTP_USER`/`SMTP_PASS` vacíos, la app sigue funcionando en **modo simulado**: en vez de mandar el correo, imprime en la consola qué hubiera enviado. Útil para probar todo el flujo antes de configurar Gmail.

Puedes forzar una revisión manual en cualquier momento (sin esperar a las 9pm) visitando:
```
POST http://localhost:3000/api/notificar-ahora
```
o simplemente abriendo esa URL con una extensión de VS Code como "Thunder Client", o con curl.

## 3. Cambiar la hora del recordatorio

En `.env`, la variable `CRON_SCHEDULE` usa formato cron (`minuto hora * * *`):
```
CRON_SCHEDULE=0 21 * * *    # 9:00 PM todos los días
CRON_SCHEDULE=30 20 * * *   # 8:30 PM todos los días
```
Y asegúrate que `TZ=America/Havana` (o tu zona horaria) esté bien puesto, si no las horas se calculan mal.

## 4. Desplegar en Railway (para que quede corriendo 24/7)

### Paso 1 — Sube el código a GitHub
```bash
git init
git add .
git commit -m "El Dayli-cio"
```
Crea un repositorio nuevo en GitHub (puede ser privado) y súbelo:
```bash
git remote add origin https://github.com/TU_USUARIO/dayli-cio.git
git branch -M main
git push -u origin main
```
`.env` y la carpeta `data/` no se subirán — están en `.gitignore` a propósito, para no exponer tus credenciales ni tu base de datos local.

### Paso 2 — Crea el proyecto en Railway
1. Entra a [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
2. Elige el repositorio `dayli-cio`.
3. Railway detecta que es Node.js (gracias a `nixpacks.toml` incluido, usará Node 22 exacto, necesario para `node:sqlite`) y arranca el primer build automáticamente. Este primer intento puede fallar o quedar "esperando" — es normal, porque faltan las variables de entorno y el volumen (siguientes pasos).

### Paso 3 — Configura las variables de entorno
En el proyecto, ve a tu servicio → pestaña **Variables** → **Raw Editor**, y pega (ajustando tus datos reales):
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=tu_contraseña_de_aplicacion
CRON_SCHEDULE=0 21 * * *
TZ=America/Havana
DATA_DIR=/data
```
No definas `PORT` — Railway lo asigna automáticamente y tu `server.js` ya lo respeta (`process.env.PORT`).

### Paso 4 — Crea el volumen persistente (crítico, no te lo saltes)
Sin este paso, **cada vez que subas un cambio nuevo se te borraría toda la base de datos**.
1. En tu servicio dentro de Railway, ve a la pestaña **Volumes**.
2. Clic en **New Volume**.
3. Como **Mount path** escribe exactamente: `/data`
4. Guarda. Railway reinicia el servicio automáticamente con el volumen ya montado.

### Paso 5 — Genera el dominio público
1. Ve a la pestaña **Settings** de tu servicio → sección **Networking**.
2. Clic en **Generate Domain**.
3. Railway te da una URL tipo `dayli-cio-production.up.railway.app` — esa es la que vas a compartir con tu familia. Todos la abren desde el navegador del celular, sin instalar nada.

### Paso 6 — Verifica que quedó bien
1. Abre la URL pública. Debes ver la interfaz de El Dayli-cio.
2. Ve a **Configuración** y agrega tus vehículos, familiares y correos (esto es aparte de lo que tengas en tu base local — la de Railway empieza vacía la primera vez).
3. Revisa los **Logs** del servicio en Railway (pestaña **Deployments** → clic en el deploy activo) — deberías ver la línea `🛺 El Dayli-cio corriendo en http://localhost:XXXX` y `⏰ Cron de recordatorio activo`.
4. Haz una prueba real: registra o borra un vehículo, y en Railway ve a **Volumes** para confirmar que el archivo `daylicio.db` existe dentro de `/data`.

### Actualizaciones futuras
Cada vez que hagas `git push` a la rama `main`, Railway vuelve a desplegar automáticamente. Como los datos viven en el volumen `/data` (no en el contenedor), **nunca se pierden** entre despliegues.

## 5. Estructura del proyecto

```
dayli-cio/
├── server.js       # Servidor Express + rutas de la API
├── db.js           # Conexión y esquema de la base de datos SQLite
├── mailer.js       # Envío de correos con Nodemailer
├── cron.js         # Tarea diaria automática (revisa y notifica)
├── public/
│   ├── index.html  # Interfaz
│   └── app.js      # Lógica del frontend
├── .env.example    # Plantilla de configuración
└── data/           # Se crea sola — aquí vive daylicio.db (NO se borra)
```

## Sobre la seguridad de los datos

- Cada registro es único por (vehículo, día): si algún familiar se equivoca o quiere corregir el monto, **corrige** el registro existente en vez de duplicarlo.
- La base de datos usa modo `WAL` de SQLite, que es más resistente a corrupción si el servidor se apaga de golpe.
- Ningún endpoint borra registros de recaudación — solo puedes desactivar usuarios/vehículos o quitar correos de la lista de notificación, nunca borrar el historial de recaudación desde la interfaz.
- Si ya tenías la app corriendo con una versión anterior (sin vehículos), la primera vez que arranques con este código **migra automáticamente** tu base de datos: crea un vehículo llamado "Triciclo principal" y le asigna todo tu historial existente, sin perder nada. Después, desde Configuración, puedes renombrarlo o agregar los demás vehículos de la familia.
