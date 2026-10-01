#!/usr/bin/env bash
set -euo pipefail
config_base="${XDG_CONFIG_HOME:-$HOME/.config}"
config_dir="$config_base/flux-gastos"
if [[ ! -d "$config_dir" && -d "$config_base/claro-gastos" ]]; then config_dir="$config_base/claro-gastos"; fi
mkdir -p "$config_dir"
chmod 700 "$config_dir"
read -r -p "Application ID de Enable Banking: " app_id
read -r -p "Ruta al archivo de clave privada .pem: " key_path
key_path="${key_path/#\~/$HOME}"
if [[ -z "$app_id" || ! -f "$key_path" ]]; then
  echo "No encuentro esa clave privada o falta el Application ID. No se guardó la configuración." >&2
  exit 1
fi
chmod 600 "$key_path"
python3 - "$config_dir/config.json" "$app_id" "$key_path" <<'PY'
import json, os, sys
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump({"application_id": sys.argv[2], "private_key_path": os.path.realpath(sys.argv[3])}, f, ensure_ascii=False, indent=2)
    f.write("\n")
os.chmod(sys.argv[1], 0o600)
PY
echo "Configuración guardada en $config_dir/config.json"
echo "Vuelve a abrir Flux para elegir un banco español disponible."
