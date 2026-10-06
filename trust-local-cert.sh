#!/usr/bin/env bash
set -euo pipefail

action="${1:-install}"
case "$action" in
  install|remove) ;;
  *) echo "Uso: $0 [install|remove]" >&2; exit 2 ;;
esac

config_base="${XDG_CONFIG_HOME:-$HOME/.config}"
config_dir="$config_base/flux-gastos"
if [[ ! -d "$config_dir" && -d "$config_base/claro-gastos" ]]; then config_dir="$config_base/claro-gastos"; fi
certificate="$config_dir/flux-localhost.crt"
database="$HOME/.pki/nssdb"
if [[ ! -f "$database/cert9.db" && ( -f "$HOME/.local/share/pki/nssdb/cert9.db" || ! -d "$database" ) ]]; then
  database="$HOME/.local/share/pki/nssdb"
fi
nickname="Flux localhost callback"

if ! command -v certutil >/dev/null 2>&1; then
  echo "Falta certutil. En Debian instálalo con: sudo apt install libnss3-tools" >&2
  exit 1
fi
if [[ "$action" == remove ]]; then
  if [[ ! -f "$database/cert9.db" ]]; then
    echo "El almacén NSS no contiene un certificado de Flux."
    exit 0
  fi
  certutil -D -d "sql:$database" -n "$nickname" >/dev/null 2>&1 || true
  echo "Certificado de localhost retirado del almacén de este usuario."
  exit 0
fi
if [[ "$action" == install && ! -s "$certificate" ]]; then
  echo "Inicia Flux una vez para crear el certificado $certificate" >&2
  exit 1
fi
if [[ ! -f "$database/cert9.db" ]]; then
  mkdir -p "$database"
  certutil -N -d "sql:$database" --empty-password
fi

certutil -D -d "sql:$database" -n "$nickname" >/dev/null 2>&1 || true
certutil -A -d "sql:$database" -n "$nickname" -t "P,," -i "$certificate"
echo "Certificado de localhost importado en el almacén de este usuario. Reinicia el navegador."
