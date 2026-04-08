# SAP Ordenes Produccion Backend

Backend en Node.js + TypeScript para consultar ordenes de produccion desde SAP Sybase y exponerlas por API.

## Requisitos

- **Node.js 18.x** (recomendado; obligatorio si usas el paquete nativo `java` / JDBC). El repo incluye `.nvmrc` y `engines` en `package.json` (`>=18 <22`).
- npm
- En servidor **Ubuntu**: unixODBC + FreeTDS (`tdsodbc`) si usas modo ODBC; **JDK 17** si usas JDBC.
- Tras `npm install` se ejecuta **`patch-package`**: corrige un bug de deteccion de version en el paquete `java` (ruta `libjvm` con JDK modernos). Los parches estan en `patches/`.

## Instalacion del proyecto

1. **Version de Node (recomendado):**
   - `nvm use` (lee `.nvmrc`)
2. **Dependencias:**
   - `npm install`
   - Si falla la compilacion nativa de `java`, puedes probar `npm install --ignore-scripts` y luego `npm rebuild odbc` cuando toque ODBC.
3. **Entorno:**
   - Copia `.env.example` a `.env` y completa valores (nunca subas `.env` al repositorio).
4. **JDBC (opcional):**
   - `export JAVA_HOME=/ruta/al/jdk-17` y `npm rebuild java` solo con Node 18.

## Configuracion completa (guía; sin datos reales)

Usa **solo placeholders** (`TU_HOST`, `TU_USUARIO`, etc.) en tickets y documentación. Los valores productivos viven **únicamente** en `.env` fuera del repo.

### 1) Archivo `.env`

```bash
cp .env.example .env
```

Bloques que debes rellenar (detalle en `.env.example`):

| Bloque | Propósito |
|--------|-----------|
| **App + API** | `PORT`, `LISTEN_HOST` (ej. `0.0.0.0` o `127.0.0.1`), `TRUST_PROXY` (`1`/`true` detrás de Apache/Nginx; `false` si accedes directo al puerto), `API_BASE_PATH`, `LOG_LEVEL`, `NODE_ENV`. |
| **Sync** | `SYNC_TABLE` (destino en SQL Server, p. ej. `ordenes_produccion`), `SYNC_ERDAT_FROM` (inicio del rango ERDAT SAP `YYYY-MM-DD`; cada corrida llega hasta hoy UTC), `SYNC_WERKS` opcional, `SYNC_BATCH_SIZE`, `SYNC_CONFLICT_KEYS`. |
| **Sybase ASE** | `SYBASE_CONNECTION_MODE` (`odbc` o `jdbc`), DSN / servidor / puerto / credenciales. El flujo de órdenes por rango usa **siempre** consulta ASE (ver sección ODBC más abajo). |
| **SQL Server (Knex)** | `DB_*` para el upsert del sync (host, puerto, base, usuario, contraseña, `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE`, pool). |
| **Prisma** | `DATABASE_URL` para `npx prisma migrate deploy` y `prisma generate` (misma instancia SQL Server que suelas usar con Knex). |

**Notas:**

- Si `DATABASE_URL` ya está **exportada en el shell** (p. ej. en CI o un perfil con `%21` en la contraseña), `dotenv` puede no pisarla: para comandos Prisma usa `env -u DATABASE_URL npx prisma ...` o quita el export.
- En la cadena Prisma, caracteres como `!` en la contraseña suelen ir **literales** entre comillas en `.env`; evita copiar versiones codificadas que el cliente envíe tal cual al motor.
- La aplicación carga `.env` con **prioridad sobre variables ya definidas** en el entorno (`override`), para que el archivo sea la referencia en servidor.

### 2) Compilación y sync manual

```bash
nvm use    # o Node 18 según .nvmrc
npm install
npm run build
npm run start   # una corrida del sync: SAP (Sybase) → tabla configurada en SYNC_TABLE
```

Comprueba logs en consola (JSON con pino). Si falta `dist/`, ejecuta antes `npm run build`.

### 3) SQL Server: esquema y migraciones

En una **base compartida** con otras tablas **no uses** `prisma db push`: podría alinear todo el esquema al `schema.prisma` y sugerir eliminar tablas que no están modeladas.

Flujo recomendado:

1. Revisar migraciones en `prisma/migrations/`.
2. Primera vez en un servidor ya con otras tablas (error tipo “schema not empty” / baseline): seguir comentarios en `.env.example` y scripts en `package.json` (`prisma:sql:apply`, `prisma:baseline:init`, `prisma:deploy`) según tu caso.
3. Cambios posteriores: `env -u DATABASE_URL npm run prisma:deploy` (y `npm run prisma:generate` si cambia el cliente).

El DDL versionado está en **`prisma/migrations/`**. Si ya tenías una tabla antigua sin `stat_sistema` / estatus y cambió la forma de `sap_line_id`, puede hacer falta **TRUNCATE** y volver a sincronizar, o migrar con la migración `20260408160000_rename_to_ordenes_produccion` si aún existía el nombre viejo de tabla.

### 4) Upsert en Microsoft SQL Server

Knex **no** implementa `.onConflict().merge()` en el dialecto `mssql`. El proyecto usa `MERGE` T‑SQL por lotes en `DatabaseService` para el sync.

### 5) Sincronización automática (cron)

1. Dar permiso de ejecución: `chmod +x scripts/sap-sync-cron.sh`
2. Asegurar que el usuario del cron tenga `HOME` correcto (necesario para **nvm**) y, si aplica, `PATH` mínimo.
3. Instalar crontab con `crontab -e`. Plantilla con placeholders: **`scripts/sap-sync.cron.example`** (sustituye `RUTA_REPO` y `TU_USUARIO`).

Incluye normalmente:

- `SHELL=/bin/bash`
- `HOME=/home/TU_USUARIO_LINUX`
- `PATH=...` (rutas estándar del sistema)
- `CRON_TZ=America/Caracas` si quieres fijar la hora en Venezuela aunque cambie la zona del servidor
- **Una sola** línea de horario, por ejemplo una vez al día a las 4:37 p.m. hora Caracas: minuto `37`, hora `16` → `37 16 * * *` seguido de la **ruta absoluta** a `scripts/sap-sync-cron.sh` y redirección a `logs/cron-sync.log` dentro del repo

El script:

- Activa nvm de forma segura bajo `cron`, comprueba `node`, opcionalmente ejecuta `npm run build` si no existe `dist/sync.js`, usa `flock` si está disponible y escribe trazas al log.

### 6) API y proxy inverso

Consistencia: el `PORT` y `API_BASE_PATH` del `.env` deben coincidir con lo que configuraste en Apache/Nginx (ver más abajo **Apache en el mismo servidor**).

## Variables de entorno (resumen)

La lista canónica y los comentarios están en **`.env.example`** (valores de ejemplo genéricos). No repetir contraseñas ni hosts reales en el README ni en issues públicos.

## Ejecucion

- Desarrollo API: `npm run dev:api`
- Build: `npm run build`
- Produccion (tras build): `npm run start:api`

Al arrancar, la API **valida** variables críticas (SQL Server, Sybase, puerto). El proceso responde a **SIGTERM/SIGINT** cerrando el servidor HTTP de forma ordenada (útil con systemd/Kubernetes).

**Health checks** (con `API_BASE_PATH=/ordenes-produccion`):

- `GET .../api/health` — liveness (sin I/O externo).
- `GET .../api/health/ready` — readiness (prueba `SELECT 1` contra SQL Server).

Las respuestas JSON incluyen `requestId` (también cabecera `X-Request-Id`) para correlacionar con logs.

Mantén el proceso activo en el `PORT` configurado; si hay un proxy inverso (Apache/Nginx) hacia ese puerto, el servicio debe estar en marcha antes de probar la URL publica. Usa `TRUST_PROXY=1` en producción detrás de proxy.

## Endpoint principal

Ruta interna del router: `GET .../api/ordenes-produccion`

Con `API_BASE_PATH=/ordenes-produccion` y `PORT=3001`:

- Directo al Node: `http://localhost:3001/ordenes-produccion/api/ordenes-produccion`
- Detras de proxy en el mismo host (solo ejemplo): `http://TU_SERVIDOR/ordenes-produccion/api/ordenes-produccion`

**Query (obligatorio / opcional):**

- `desde`, `hasta`: fechas `YYYY-MM-DD`
- `werks`: opcional (centro)

**Respuesta:**

- Exito: `{ "ok": true, "data": [...] }`
- Error: `{ "ok": false, "msg": "..." }`

## Apache en el mismo servidor (SPA + esta API)

Si el unico `VirtualHost` en el puerto 80 sirve un frontend React y reenvia rutas inexistentes a `index.html`, hay que enrutar **antes** el prefijo de esta API hacia Node (`ProxyPass` / `RewriteRule [P]`). Ejemplo de `VirtualHost` (sustituye `TU_*` y el puerto por tu `PORT` / `API_BASE_PATH`):

```apache
<VirtualHost *:80>
    ServerName TU_DOMINIO_O_IP
    DocumentRoot /var/www/html/TU_SPA/build
    ProxyRequests Off
    ProxyPreserveHost On
    RewriteEngine On
    RewriteRule ^/ordenes-produccion/(.*)$ http://127.0.0.1:3001/ordenes-produccion/$1 [P,L]
    ProxyPassReverse /ordenes-produccion/ http://127.0.0.1:3001/ordenes-produccion/
    <Directory "/var/www/html/TU_SPA/build">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
</VirtualHost>
```

`sudo a2enmod proxy proxy_http rewrite` y recarga de Apache tras `apache2ctl configtest`.

## Ubuntu: ODBC + FreeTDS (ASE)

### Paquetes

```bash
sudo apt update
sudo apt install -y unixodbc unixodbc-dev freetds-bin freetds-common tdsodbc build-essential python3
```

Comprueba la ruta del driver:

```bash
dpkg -L tdsodbc | grep '\.so'
```

Suele ser: `/usr/lib/x86_64-linux-gnu/odbc/libtdsodbc.so`

### `/etc/odbcinst.ini`

Entrada minima (ruta `Driver` segun tu sistema):

```ini
[FreeTDS]
Description=FreeTDS Driver for Sybase / MS SQL
Driver=/usr/lib/x86_64-linux-gnu/odbc/libtdsodbc.so
```

### DSN y cifrado de login (ASE)

Muchos ASE exigen cifrado del password en red. En **FreeTDS 1.3** el valor valido es `encryption = require` (no `required`).

Opcion A — **Usuario actual** (`~/.freetds.conf` + `~/.odbc.ini`): util si no puedes editar `/etc` a menudo.

`~/.freetds.conf`:

```ini
[global]
	tds version = 5.0

[sap_ase_odbc]
	host = TU_HOST_ASE
	port = TU_PUERTO_ASE
	tds version = 5.0
	encryption = require
```

`~/.odbc.ini`:

```ini
[SAP_ASE]
Driver=FreeTDS
Servername=sap_ase_odbc
```

El nombre `sap_ase_odbc` debe coincidir con la seccion entre corchetes en `freetds.conf`. En `.env` usa el mismo nombre en `SYBASE_DSN=SAP_ASE` que la seccion `[SAP_ASE]` de `odbc.ini`.

Opcion B — **Sistema**: mismas secciones en `/etc/freetds/freetds.conf` y `/etc/odbc.ini` (el contenido es el de los bloques de arriba).

Si `require` no encaja con tu politica de servidor, prueba `encryption = request`.

### Probar conexion

```bash
isql -v SAP_ASE tu_usuario tu_password
```

(No pegues contrasenas reales en tickets ni commits.)

### Minimo en `.env` (ODBC)

```env
SYBASE_CONNECTION_MODE=odbc
SYBASE_DSN=SAP_ASE
SYBASE_DRIVER=FreeTDS
SYBASE_SERVER=TU_HOST_ASE
SYBASE_PORT=TU_PUERTO_ASE
SYBASE_UID=tu_usuario
SYBASE_PWD=tu_password
```

Ajusta `SYBASE_DSN` si cambias el nombre del bloque en `odbc.ini`.

## Windows (local)

### 1) Verificar drivers ODBC instalados

En PowerShell: `Get-OdbcDriver | Select-Object Name` (debe existir un driver compatible con Sybase/ASE).

### 2) DSN

Crear DSN de sistema con el asistente ODBC (host, puerto, base si aplica) y usar el mismo nombre en `SYBASE_DSN`.

### 3) `.env` (ejemplo generico)

```env
SYBASE_CONNECTION_MODE=odbc
SYBASE_DSN=TU_DSN_WINDOWS
SYBASE_UID=tu_usuario
SYBASE_PWD=tu_password
```

## Nota SQL y ODBC

Las consultas enviadas por este driver **no deben terminar en punto y coma** (`;`): algunos servidores/FreeTDS devuelven error de sintaxis. El proyecto ya evita el `;` final en la query principal por rango de fechas.

## Troubleshooting

| Sintoma | Causa probable |
|---------|----------------|
| `IM002` / datasource not found | DSN o driver no registrados en `odbc.ini` / `odbcinst.ini`. |
| Login encryption / encrypt password | Falta `encryption = require` (o `request`) en `freetds.conf` para la entrada usada por `Servername`. |
| `Incorrect syntax near ';'` | Quitar `;` final del SQL enviado por ODBC. |
| `503` vía Apache | Node no escucha en el `PORT` del proxy; arranca la API. |
| El navegador recibe HTML del SPA en la ruta de la API | Falta regla de proxy **antes** del fallback SPA (ver ejemplo Apache arriba). |
| Error nativo `java` / NAN en Node 22 | Usar Node 18 LTS (`nvm use`). |
| `cannot find -ljvm` al compilar `java` | Definir `JAVA_HOME`; ver parche + `find_java_libdir` en `patches/java+*.patch`. |
| Sync por **cron** no hace nada / termina al instante | Ver `logs/cron-sync.log`: falta `HOME` para nvm, `node` fuera del `PATH`, o fallo previo de `source nvm.sh` con `set -e` (el script del repo mitiga esto). Comprobar `crontab -l` y zona `CRON_TZ` si aplica. |
| Sync corre pero **no escribe** en SQL Server | Comprobar `SYNC_TABLE`, credenciales `DB_*`, y que exista la tabla en el destino (migraciones). Revisar logs de error del `MERGE` (Knex no usa `onConflict` en MSSQL; el código usa `MERGE`). |

## Seguridad

- No subas `.env` ni pegues contrasenas en README, issues ni chats publicos.
- Rota credenciales si se filtraron.
- Limita acceso al puerto de la API con firewall o solo `127.0.0.1` + proxy.
