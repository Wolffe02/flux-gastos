#!/usr/bin/env bash
set -euo pipefail

action="${1:-install}"
case "$action" in
  install|remove) ;;
  *) echo "Uso: $0 [install|remove]" >&2; exit 2 ;;
esac

config_dir="$HOME/Library/Application Support/flux-gastos"
if [[ ! -d "$config_dir" && -d "$HOME/Library/Application Support/claro-gastos" ]]; then
  config_dir="$HOME/Library/Application Support/claro-gastos"
fi
certificate="$config_dir/flux-localhost.crt"
keychain="$(security default-keychain -d user | tr -d '"')"

if [[ "$action" == install ]]; then
  if [[ ! -s "$certificate" ]]; then
    echo "Inicia Flux una vez para crear el certificado $certificate" >&2
    exit 1
  fi
  security add-trusted-cert -r trustAsRoot -p ssl -k "$keychain" "$certificate"
  echo "Certificado localhost confiado en el llavero de tu usuario. Reinicia el navegador."
else
  if [[ ! -s "$certificate" ]]; then
    echo "No encuentro el certificado $certificate para identificarlo y retirarlo." >&2
    exit 1
  fi
  security delete-certificate -c "Flux localhost callback" "$keychain"
  echo "Certificado localhost retirado del llavero de tu usuario."
fi
