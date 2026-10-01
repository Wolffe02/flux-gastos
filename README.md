# Flux para Debian

Aplicación de escritorio local para Debian 13. Abre su panel en el navegador predeterminado y ejecuta un servicio solo en `127.0.0.1`. La conexión bancaria es de solo lectura. Guarda el historial importado en SQLite dentro de `~/.local/share/flux-gastos/`; la clave de la aplicación se queda fuera de esta carpeta y nunca se envía al navegador.

Flux es software local: cada persona debe descargar el código, registrar su propia aplicación Enable Banking y autorizar su propia cuenta. El repositorio público no incluye un servicio central ni comparte claves o datos bancarios entre usuarios. No publiques capturas ni archivos de datos reales.

## Abrir la aplicación

Desde esta carpeta ejecuta `./run.sh`. Para crear un acceso en el menú de aplicaciones, ejecuta `./install-desktop.sh` una vez. Python 3 y OpenSSL deben estar instalados; no hace falta instalar paquetes de Python.

## Activar la conexión real con CaixaBank

La app usa Enable Banking porque su documentación para España incluye CaixaBank y describe el flujo de autenticación en CaixaBankNow. La cobertura efectiva, el acceso a producción y los términos pueden depender de Enable Banking y del banco; su lista de bancos se consulta en tiempo real al pulsar conectar.

1. Crea una cuenta en el [panel de Enable Banking](https://enablebanking.com/sign-in/) y registra una aplicación **Production** para uso personal.
2. Añade esta URL de redirección exacta a la aplicación: `http://127.0.0.1:8765/callback`.
3. Descarga o genera la clave privada RSA y conserva el **Application ID** que te da el panel. No compartas la clave privada ni la subas a la nube.
4. Activa la aplicación en el modo restringido vinculando la cuenta CaixaBank propia, siguiendo la opción “Activate by linking accounts” de la [guía oficial](https://enablebanking.com/docs/api/linked-accounts/). El modo restringido limita el acceso a las cuentas que hayas vinculado.
5. En esta carpeta ejecuta `./configure.sh`. Introduce el Application ID y la ruta local de la clave `.pem`; la app guarda la configuración en `~/.config/flux-gastos/config.json` con permisos privados.
6. Abre Flux y pulsa **Conectar CaixaBank**. Autoriza solo el acceso de consulta en el flujo oficial del banco. Al volver a la aplicación se importará el historial disponible de hasta seis meses. Pulsa **Sincronizar** para actualizarlo manualmente.

No introduzcas credenciales de CaixaBank en Flux. La autenticación y la aprobación se hacen en la página/flujo de CaixaBankNow. Para dejar de compartir datos, pulsa **Desconectar** o revoca el consentimiento desde CaixaBank. Desconectar también borra la copia local importada.

Enable Banking permite activar aplicaciones propias en modo restringido para uso individual, aunque el acceso productivo sin restricciones requiere revisión contractual. Comprueba sus términos y posibles costes antes de dar de alta el servicio: [FAQ y tarifas](https://enablebanking.com/docs/faq/), [términos](https://enablebanking.com/terms/).

## Alcance de la clasificación

La app importa transacciones de los últimos seis meses. Muestra cargos repetidos de importe parecido y estima el coste mensual medio. Las categorías se asignan mediante palabras del concepto bancario, así que conviene revisar los resultados. Recibos o suscripciones que no aparezcan claramente en el concepto pueden quedar en “Recurrentes”. El historial y los datos bancarios no salen del ordenador salvo las llamadas de consentimiento/consulta a Enable Banking y CaixaBank.
