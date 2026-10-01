# Flux

Flux organiza los gastos mensuales en suscripciones, recibos y pagos recurrentes, con una interfaz cyberpunk sencilla.

## Plataformas

- **Android, Windows y iPhone/iPad:** abre [Flux](https://wolffe02.github.io/flux-gastos/) con Chrome/Edge en Android, Edge en Windows o Safari en iOS. Instálala desde el menú del navegador; en iOS usa **Compartir → Añadir a pantalla de inicio**. La PWA guarda los datos en ese dispositivo y también abre sin conexión después de la primera visita.
- **Aplicación Android:** el flujo de GitHub Actions genera un APK de instalación directa cuando se actualiza `main`. Está en la sección **Actions → Build mobile apps → Artifacts**.
- **Aplicación Windows:** el flujo **Build desktop apps** genera `Flux.exe` con el servidor local incluido. Permite conectar bancos sin subir la clave privada ni los movimientos a un servidor remoto.
- **Aplicación macOS:** el mismo flujo genera `Flux.app` empaquetada en `Flux-macOS.zip`.
- **Aplicación nativa iOS:** el flujo móvil genera una compilación para el simulador de Xcode. Para instalar y distribuir una app nativa en iPhone se requiere firma de Apple; la PWA anterior sí se puede instalar en el iPhone sin esa firma.
- **Debian 13:** conserva la aplicación local de escritorio, que también puede conectar los bancos españoles que aparezcan disponibles en Enable Banking.

Las entradas manuales se guardan localmente en cada dispositivo y no se sincronizan entre ellos.

La PWA y las apps nativas Android/iOS sirven para llevar gastos manualmente y guardan los datos en el dispositivo. El acceso bancario local funciona en Debian, Windows y macOS. La conexión directa desde iPhone o Android requiere un servicio alojado seguro y autorización de producción de Enable Banking; el repositorio público no contiene un servicio central ni claves compartidas.

No publiques capturas ni archivos de datos reales.

## Abrir la aplicación

Desde Debian ejecuta `./run.sh`. Para crear un acceso en el menú de aplicaciones, ejecuta `./install-desktop.sh` una vez. Python 3 está incluido en Debian; OpenSSL permite firmar las peticiones bancarias sin instalar paquetes de Python.

En **Windows**, descomprime `Flux.exe` desde el artefacto `flux-windows` y ejecútalo. Si ejecutas desde el código, abre PowerShell en la carpeta y ejecuta `./install-windows.ps1`; luego abre `run.bat`. En **macOS**, descomprime `Flux-macOS.zip` y abre `Flux.app`. Desde el código, ejecuta `./install-macos.sh` y luego `./run.sh`.

## Activar la conexión bancaria

La app consulta en tiempo real el catálogo de bancos españoles que Enable Banking ofrece para cuentas personales. La lista puede incluir CaixaBank, BBVA, Santander, Sabadell, Bankinter, Kutxabank, Unicaja y otros; cambia según la disponibilidad del proveedor y la autorización de tu aplicación. Flux vuelve a consultar esa lista cada vez que vas a conectar un banco. Se conecta un banco cada vez; desconéctalo antes de cambiar a otro.

1. Crea una cuenta en el [panel de Enable Banking](https://enablebanking.com/sign-in/) y registra una aplicación **Production** para uso personal.
2. Añade esta URL de redirección exacta a la aplicación: `http://127.0.0.1:8765/callback`. Es la misma en Debian, Windows y macOS.
3. Descarga o genera la clave privada RSA y conserva el **Application ID** que te da el panel. No compartas la clave privada ni la subas a la nube.
4. Activa la aplicación en el modo restringido vinculando las cuentas que utilizarás, siguiendo la opción “Activate by linking accounts” de la [guía oficial](https://enablebanking.com/docs/api/linked-accounts/). El modo restringido limita el acceso a las cuentas que hayas vinculado.
5. Abre Flux en tu ordenador, pulsa **Configurar acceso** y selecciona el Application ID y el archivo `.pem`. Flux guarda la clave y la configuración dentro del directorio privado de la app en ese dispositivo.
6. Elige el banco en la lista y pulsa **Conectar banco**. Autoriza solo el acceso de consulta en el flujo oficial del banco. Al volver a la aplicación se importarán los movimientos disponibles de hasta seis meses. Pulsa **Sincronizar** para actualizarlo manualmente.

No introduzcas credenciales de acceso bancario en Flux. La autenticación y aprobación se hacen en la página o aplicación oficial de cada banco. Para dejar de compartir datos, pulsa **Desconectar** o revoca el consentimiento desde tu banco. Desconectar también borra la copia local importada.

Cada persona configura su propia aplicación de Enable Banking y autoriza su propia cuenta; el modo restringido vincula esa aplicación a las cuentas que esa persona haya permitido. Una app pública multiusuario con conexión bancaria requiere acceso productivo y las condiciones contractuales de Enable Banking. Comprueba posibles costes y requisitos antes de registrarte: [FAQ y tarifas](https://enablebanking.com/docs/faq/), [términos](https://enablebanking.com/terms/).

## Alcance de la clasificación

La app importa transacciones de los últimos seis meses. Muestra cargos repetidos de importe parecido y estima el coste mensual medio. Las categorías se asignan mediante palabras del concepto bancario, así que conviene revisar los resultados. Recibos o suscripciones que no aparezcan claramente en el concepto pueden quedar en “Recurrentes”. El historial y los datos bancarios no salen del ordenador salvo las llamadas de consentimiento/consulta a Enable Banking y tu banco.

## Compilar los paquetes nativos

Los workflows de Actions compilan los proyectos con las herramientas oficiales de cada plataforma y guardan los instaladores como artefactos de la ejecución.

- **Android:** Android Studio abre `native/android`; antes de compilar ejecuta `./sync-native-web-assets.sh`. El APK debug se crea con `gradle :app:assembleDebug`.
- **Windows/macOS:** los binarios locales se crean con PyInstaller y la dependencia `cryptography`.
- **iOS:** en macOS ejecuta primero `./sync-native-web-assets.sh`, instala Xcode y XcodeGen, y genera el proyecto con `xcodegen generate --spec native/ios/project.yml --project native/ios`.

Los paquetes Android y Windows generados por Actions son para instalación directa. Para publicarlos en las tiendas hay que crear las cuentas de desarrollador y firmar los paquetes. La compilación iOS de Actions es para el simulador; distribuirla a iPhone exige una identidad de firma de Apple.
