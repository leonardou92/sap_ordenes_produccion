#!/usr/bin/env bash
# Sincronización FACT_CONSUMOS → SQL Server (tabla fact_consumos).
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly LOG_DIR="${PROJECT_ROOT}/logs"
readonly LOCK_FILE="/tmp/sap-fact-consumos-sync.lock"

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

log "Inicio job cron FACT_CONSUMOS: $(command -v node) $(node -v)"

if command -v flock >/dev/null 2>&1; then
  exec 9>"${LOCK_FILE}"
  if ! flock -n 9; then
    log "Omitido: otra sincronización FACT_CONSUMOS en curso (lock ${LOCK_FILE})"
    exit 0
  fi
fi

npm run dev:fact-consumos
log "FACT_CONSUMOS: sync finalizado OK"

