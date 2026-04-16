#!/usr/bin/env bash
# Sincronización SAP → SQL Server para KPI_PROD_COSTOS.
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly LOG_DIR="${PROJECT_ROOT}/logs"
readonly LOCK_FILE="/tmp/sap-costos-sync.lock"

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

log "Inicio job cron costos: $(command -v node) $(node -v)"

if [[ ! -f "${PROJECT_ROOT}/dist/sync-costos.js" ]]; then
  log "Aviso: no hay dist/sync-costos.js; ejecutando npm run build…"
  npm run build || {
    log "ERROR: npm run build falló"
    exit 1
  }
fi

if command -v flock >/dev/null 2>&1; then
  exec 9>"${LOCK_FILE}"
  if ! flock -n 9; then
    log "Omitido: otra sincronización costos en curso (lock ${LOCK_FILE})"
    exit 0
  fi
fi

node "${PROJECT_ROOT}/dist/sync-costos.js"
log "Sync costos finalizado OK"
