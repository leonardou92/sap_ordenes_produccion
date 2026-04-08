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

## Variables de entorno relevantes (API y red)

Definidas en `.env.example` (valores reales solo en tu `.env` local):

| Variable | Descripcion |
|----------|-------------|
| `PORT` | Puerto donde escucha Express (ej. `3001` si otro backend usa `3000`). |
| `API_BASE_PATH` | Prefijo de URL (ej. `/ordenes-produccion`). La API queda en `{API_BASE_PATH}/api/...`. |
| `SAP_SOURCE_MODE` | `sybase` para consultas directas ASE. |
| `SYBASE_CONNECTION_MODE` | `odbc` o `jdbc`. |
| `SYBASE_DSN` | Nombre del DSN en `odbc.ini` (debe coincidir). |
| `SYBASE_SERVER`, `SYBASE_PORT` | Host y puerto ASE (tambien usados en modo sin DSN). |
| `SYBASE_UID`, `SYBASE_PWD` | Credenciales SAP (solo en `.env`, no en documentacion con valores reales). |
| `SYBASE_DB` | Base por defecto si tu ASE lo exige. |
| `JVM_PATH` | Ruta a `lib/server` del JDK (JDBC). |

## Ejecucion

- Desarrollo API: `npm run dev:api`
- Build: `npm run build`
- Produccion (tras build): `npm run start:api`

Mantén el proceso activo en el `PORT` configurado; si hay un proxy inverso (Apache/Nginx) hacia ese puerto, el servicio debe estar en marcha antes de probar la URL publica.

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

Si el unico `VirtualHost` en el puerto 80 sirve un frontend React y reenvia rutas inexistentes a `index.html`, hay que enrutar **antes** el prefijo de esta API hacia Node (`ProxyPass` / `RewriteRule [P]`). Archivos de referencia **sin credenciales**:

- `deploy/frontend-sara-with-api-proxy.conf` — ejemplo de VirtualHost con proxy a `127.0.0.1:PUERTO_NODE`
- `deploy/enable-apache-proxy.sh` — script que hace backup y aplica la conf (requiere ejecutarlo con permisos de administrador en el servidor)

Sustituye el puerto en el proxy por el valor de `PORT` en tu `.env`.

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

Opcion B — **Sistema**: mismas secciones en `/etc/freetds/freetds.conf` y `/etc/odbc.ini` (ver fragmentos en `deploy/freetds-sap-ase.snippet` y `deploy/odbc.ini.with-encryption.snippet`).

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
| El navegador recibe HTML del SPA en la ruta de la API | Falta regla de proxy **antes** del fallback SPA (ver `deploy/`). |
| Error nativo `java` / NAN en Node 22 | Usar Node 18 LTS (`nvm use`). |
| `cannot find -ljvm` al compilar `java` | Definir `JAVA_HOME`; ver parche + `find_java_libdir` en `patches/java+*.patch`. |

## Seguridad

- No subas `.env` ni pegues contrasenas en README, issues ni chats publicos.
- Rota credenciales si se filtraron.
- Limita acceso al puerto de la API con firewall o solo `127.0.0.1` + proxy.
