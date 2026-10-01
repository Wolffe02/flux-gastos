#!/usr/bin/env bash
set -euo pipefail
app_dir="$(cd "$(dirname "$0")" && pwd)"
apps_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
mkdir -p "$apps_dir"
cat > "$apps_dir/flux.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Flux
Comment=Visualiza tus gastos y pagos bancarios recurrentes
Exec="$app_dir/run.sh"
Icon="$app_dir/icons/flux-192.png"
Terminal=true
Categories=Office;Finance;
DESKTOP
chmod 644 "$apps_dir/flux.desktop"
echo "Acceso creado en el menú de aplicaciones."
