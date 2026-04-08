#!/usr/bin/env bash
# Activa proxy hacia la API de órdenes en el mismo VirtualHost que frontend-sara.
# Uso: sudo bash /var/www/html/sap_ordenes_produccion/deploy/enable-apache-proxy.sh
set -euo pipefail
ROOT="/var/www/html/sap_ordenes_produccion/deploy"
TARGET="/etc/apache2/sites-available/frontend-sara.conf"
if [[ ! -f "$TARGET" ]]; then
  echo "No existe $TARGET" >&2
  exit 1
fi
cp -a "$TARGET" "${TARGET}.bak-$(date +%Y%m%d%H%M%S)"
cp "${ROOT}/frontend-sara-with-api-proxy.conf" "$TARGET"
a2enmod proxy proxy_http rewrite
apache2ctl configtest
systemctl reload apache2
echo "Apache listo. Asegúrate de tener la API en marcha: cd /var/www/html/sap_ordenes_produccion && nvm use && npm run dev:api"
echo "Prueba: curl -sS 'http://127.0.0.1/ordenes-produccion/api/ordenes-produccion' | head -c 200"
