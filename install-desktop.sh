#!/usr/bin/env bash
set -euo pipefail

source_dir="$(cd "$(dirname "$0")" && pwd)"
install_dir="${HOME}/.local/opt/flux-gastos"
install_parent="$(dirname "$install_dir")"
apps_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
mkdir -p "$install_parent" "$apps_dir"
stage="$(mktemp -d "$install_parent/.flux-gastos.XXXXXX")"
trap 'rm -rf -- "$stage"' EXIT

cp "$source_dir"/{app.py,app.js,index.html,manifest.webmanifest,service-worker.js,privacidad.html,condiciones.html,run.sh,trust-local-cert.sh,LICENSE,README.md} "$stage/"
cp -a "$source_dir/icons" "$stage/icons"
chmod 755 "$stage/run.sh" "$stage/trust-local-cert.sh"

if [[ "$install_dir" != "$HOME/.local/opt/flux-gastos" ]]; then
  echo "Ruta de instalación inesperada: $install_dir" >&2
  exit 1
fi
rm -rf -- "$install_dir"
mv "$stage" "$install_dir"

cat > "$apps_dir/flux.desktop" <<DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=Flux
Comment=Visualiza tus gastos mensuales
Exec="$install_dir/run.sh"
Icon=$install_dir/icons/flux-192.png
Terminal=true
Categories=Office;Finance;
StartupNotify=true
DESKTOP
chmod 644 "$apps_dir/flux.desktop"

desktop_dir=""
if command -v xdg-user-dir >/dev/null 2>&1; then
  desktop_dir="$(xdg-user-dir DESKTOP 2>/dev/null || true)"
fi
if [[ ! -d "$desktop_dir" ]]; then
  for candidate in "$HOME/Escritorio" "$HOME/Desktop"; do
    if [[ -d "$candidate" ]]; then desktop_dir="$candidate"; break; fi
  done
fi
if [[ -n "$desktop_dir" ]]; then
  cp "$apps_dir/flux.desktop" "$desktop_dir/Flux.desktop"
  chmod 755 "$desktop_dir/Flux.desktop"
fi

echo "Flux instalado en $install_dir"
echo "Acceso añadido al menú de aplicaciones${desktop_dir:+ y al escritorio ($desktop_dir)}."
