#!/usr/bin/env bash
# Sincronización FACT_PRODUCCION_DETALLE_REPORTE → SQL Server.
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly LOG_DIR="${PROJECT_ROOT}/logs"
readonly LOCK_FILE="/tmp/sap-fact-produccion-detalle-reporte-sync.lock"

mkdir -p "$LOG_DIR"

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
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

log "Inicio job cron FACT_PRODUCCION_DETALLE_REPORTE: $(command -v node) $(node -v)"

if [[ ! -f "${PROJECT_ROOT}/dist/sync-fact-produccion-detalle-reporte.js" ]]; then
  log "Aviso: no hay dist/sync-fact-produccion-detalle-reporte.js; ejecutando npm run build…"
  npm run build || {
    log "ERROR: npm run build falló"
    exit 1
  }
fi

if command -v flock >/dev/null 2>&1; then
  exec 9>"${LOCK_FILE}"
  if ! flock -n 9; then
    log "Omitido: otra sincronización FACT_PRODUCCION_DETALLE_REPORTE en curso (lock ${LOCK_FILE})"
    exit 0
  fi
fi

node "${PROJECT_ROOT}/dist/sync-fact-produccion-detalle-reporte.js"
log "FACT_PRODUCCION_DETALLE_REPORTE: sync finalizado OK"
