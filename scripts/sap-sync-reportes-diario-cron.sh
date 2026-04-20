#!/usr/bin/env bash
# Sincronización de los 4 reportes diario PB → SQL Server.
# Cada tarea escribe en su propio archivo bajo logs/ (inicio/fin y salida de Node).
# Requiere ENABLE_SYNC=true, SYNC_FECHA_INICIO, Sybase y SQL Server en .env.
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly LOG_DIR="${PROJECT_ROOT}/logs"
readonly LOCK_FILE="/tmp/sap-reportes-diario-sync.lock"

# Un log por reporte (trazas separadas; fácil ver si terminó cada uno)
readonly LOG_RESUMEN="${LOG_DIR}/reporte_pb_fact_produccion_resumen.log"
readonly LOG_RECEPCION="${LOG_DIR}/reporte_pb_fact_recepcion_camiones.log"
readonly LOG_DETALLE="${LOG_DIR}/reporte_pb_fact_produccion_detalle_reporte.log"
readonly LOG_EMPAQUE="${LOG_DIR}/reporte_pb_fact_materiales_empaque.log"

mkdir -p "$LOG_DIR"

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
}

log_to_file() {
  local file="$1"
  shift
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*" >> "$file"
}

# Ejecuta un sync Node y registra inicio/fin en el log dedicado. Sale con el código de node si falla.
run_reporte() {
  local nombre="$1"
  local logfile="$2"
  local js="$3"

  log_to_file "$logfile" "=== Inicio ${nombre} ==="
  set +e
  node "${PROJECT_ROOT}/dist/${js}" >> "$logfile" 2>&1
  local rc=$?
  set -e
  if [[ "$rc" -eq 0 ]]; then
    log_to_file "$logfile" "=== Fin ${nombre} (OK) ==="
    log "${nombre}: terminado OK → ${logfile}"
  else
    log_to_file "$logfile" "=== Fin ${nombre} (ERROR, código ${rc}) ==="
    log "${nombre}: ERROR código ${rc} → ${logfile}"
    exit "$rc"
  fi
}

if [[ ! -f "${PROJECT_ROOT}/.env" ]]; then
  log "ERROR: falta ${PROJECT_ROOT}/.env"
  exit 1
fi

cd "$PROJECT_ROOT"

export NODE_ENV="${NODE_ENV:-production}"

if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
  set +e
  # shellcheck source=/dev/null
  source "${HOME}/.nvm/nvm.sh"
  set -e
  nvm use --silent 2>/dev/null || nvm use 18 --silent || {
    log "ERROR: nvm use falló (¿falta Node 18 en nvm?)"
    exit 1
  }
fi

if ! command -v node >/dev/null 2>&1; then
  log "ERROR: node no está en PATH (HOME=${HOME:-<vacío>})"
  exit 1
fi

log "Inicio job cron reportes diario PB: $(command -v node) $(node -v)"
log "Logs por tarea: ${LOG_RESUMEN} | ${LOG_RECEPCION} | ${LOG_DETALLE} | ${LOG_EMPAQUE}"

need_build=false
for js in \
  sync-fact-produccion-resumen.js \
  sync-fact-recepcion-camiones.js \
  sync-fact-produccion-detalle-reporte.js \
  sync-fact-materiales-empaque.js; do
  if [[ ! -f "${PROJECT_ROOT}/dist/${js}" ]]; then
    need_build=true
    break
  fi
done

if [[ "$need_build" == true ]]; then
  log "Aviso: no hay dist/ completo; ejecutando npm run build…"
  npm run build || {
    log "ERROR: npm run build falló"
    exit 1
  }
fi

if command -v flock >/dev/null 2>&1; then
  exec 9>"${LOCK_FILE}"
  if ! flock -n 9; then
    log "Omitido: otra sincronización reportes diario PB en curso (lock ${LOCK_FILE})"
    exit 0
  fi
fi

run_reporte "FACT_PRODUCCION_RESUMEN" "$LOG_RESUMEN" "sync-fact-produccion-resumen.js"
run_reporte "FACT_RECEPCION_CAMIONES" "$LOG_RECEPCION" "sync-fact-recepcion-camiones.js"
run_reporte "FACT_PRODUCCION_DETALLE_REPORTE" "$LOG_DETALLE" "sync-fact-produccion-detalle-reporte.js"
run_reporte "FACT_MATERIALES_EMPAQUE" "$LOG_EMPAQUE" "sync-fact-materiales-empaque.js"

log "Reportes diario PB: las 4 tareas terminaron OK (logs separados arriba)"
