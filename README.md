# SAP Ordenes Produccion Backend

Backend en Node.js + TypeScript para consultar ordenes de produccion desde SAP Sybase y exponerlas por API.

## Requisitos

- Node.js 18 LTS o 20 LTS (para `jdbc` en Linux conviene 18)
- npm
- En servidor **Ubuntu**: unixODBC + FreeTDS (`tdsodbc`) si usas modo `odbc`

## Instalacion del proyecto

1. Instalar dependencias:
   - `npm install`
2. Crear archivo de entorno:
   - Copiar `.env.example` a `.env`
3. Configurar variables en `.env` (especialmente bloque SAP Sybase)

## Ejecucion

- Modo desarrollo API:
  - `npm run dev:api`
- Build:
  - `npm run build`
- Ejecutar build:
  - `npm run start:api`

## Endpoint principal

- `GET /api/ordenes-produccion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&werks=PB00`
- `werks` es opcional.

Respuesta:

- Exito: `{ "ok": true, "data": [...] }`
- Error: `{ "ok": false, "msg": "..." }`

## Configuracion Sybase en .env

Variables clave:

- `SAP_SOURCE_MODE=sybase`
- `SYBASE_CONNECTION_MODE=odbc` (recomendado)
- `SYBASE_DSN=` (si usas DSN)
- `SYBASE_DRIVER=...` (si conectas sin DSN)
- `SYBASE_SERVER=...`
- `SYBASE_PORT=4901`
- `SYBASE_UID=...`
- `SYBASE_PWD=...`

## Windows (local)

### 1) Verificar drivers ODBC instalados

En PowerShell:

- `Get-OdbcDriver | Select-Object Name`

Debe aparecer un driver de Sybase (no solo SQL Server).

### 2) Crear DSN (recomendado)

1. Abrir `ODBC Data Sources (64-bit)`.
2. Ir a `System DSN` -> `Add`.
3. Elegir driver de Sybase.
4. Configurar host, puerto, usuario y probar conexion.
5. Guardar DSN, por ejemplo: `SAP_KIRI_DSN`.

### 3) Configurar .env

Ejemplo:

```env
SYBASE_CONNECTION_MODE=odbc
SYBASE_DSN=SAP_KIRI_DSN
SYBASE_UID=tu_usuario
SYBASE_PWD=tu_password
```

### 4) Levantar API

- `npm run dev:api`

## Ubuntu (recomendado para desarrollo sin driver comercial en Windows)

### 1) Dependencias de sistema

```bash
sudo apt update
sudo apt install -y unixodbc unixodbc-dev freetds-bin freetds-common tdsodbc build-essential python3
```

Si usas JDBC (`npm install jdbc`), usa **Node.js 18 LTS** (evita errores del addon nativo `java` con Node 22).

### 2) Registrar driver FreeTDS (si no aparece solo)

Comprueba el nombre del driver:

```bash
odbcinst -q -d
```

Suele ser `FreeTDS`. Si falta, en `/etc/odbcinst.ini` (o con `sudo odbcinst -i -d -f /usr/share/tdsodbc/odbcinst.ini` segun tu distro) debe existir una entrada apuntando a `libtdsodbc.so`.

### 3) Crear DSN

Edita `/etc/odbc.ini` (sistema) o `~/.odbc.ini` (usuario). Ejemplo:

```ini
[SAP_ASE]
Driver = FreeTDS
Server = 10.1.6.234
Port = 4901
TDS_Version = 5.0
```

Ajusta `TDS_Version` si el servidor lo requiere (5.0 es comun para ASE).

Prueba conexión:

```bash
isql -v SAP_ASE tu_usuario tu_password
```

### 4) Configurar `.env` en el servidor

```bash
cp .env.example .env
nano .env
```

Completa `SYBASE_UID`, `SYBASE_PWD`, `SYBASE_SERVER`, `SYBASE_DSN` si cambia el nombre del DSN en `odbc.ini`.

Minimo para ODBC:

```env
SYBASE_CONNECTION_MODE=odbc
SYBASE_DSN=SAP_ASE
SYBASE_DRIVER=FreeTDS
SYBASE_SERVER=10.1.6.234
SYBASE_PORT=4901
SYBASE_UID=tu_usuario
SYBASE_PWD=tu_password
```

### 5) Node y proyecto

```bash
npm install
npm run dev:api
```

### 6) Si ASE exige cifrado de password en login

FreeTDS a veces no cubre el mismo esquema que jConnect. Si `isql` falla con error de encrypt, pide a DBA el `jconn4.jar` y usa `SYBASE_CONNECTION_MODE=jdbc` (ver comentarios en `.env.example`).

## Troubleshooting

- Error `IM002`:
  - No existe DSN o driver ODBC de Sybase en el sistema.
- Error `EADDRINUSE`:
  - El puerto `3000` ya esta en uso.
- Respuesta vacia `data: []`:
  - Revisar rango de fechas, `werks` y que la query tenga datos en SAP.

## Seguridad

- No subir `.env` al repositorio.
- Rotar credenciales si fueron compartidas por chat o logs.
