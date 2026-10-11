# Trazo

App de dibujo inspirada en ibisPaint, hecha con HTML, CSS y JavaScript. Funciona en el navegador, como app instalable en el celular, como **APK de Android** y como **programa para Windows y Linux**.

## Descargas

Cada cambio en `main` compila todo automáticamente. Las descargas quedan en la sección **Releases** del repositorio:

| Archivo | Para qué sirve |
| --- | --- |
| `Trazo.apk` | Android. Ábrelo en el celular y permite "instalar apps de origen desconocido". |
| `Trazo-Setup-x.y.z.exe` | Instalador para Windows. |
| `Trazo-Portable-x.y.z.exe` | Windows sin instalar (doble clic y listo). |
| `Trazo-x.y.z.AppImage` | Linux. |

La versión web queda en GitHub Pages: `https://jeremygomezf.github.io/Trazo/`. Desde el celular, ábrela en Chrome y elige **Añadir a pantalla de inicio** para tenerla como app, también sin internet.

## Qué tiene

**Pinceles:** lápiz con grano, pluma, pluma G, rotulador, marcador, pincel suave, aerógrafo, acuarela, carboncillo, puntos y pixel. Cada uno con tamaño, opacidad, estabilizador, dureza, espaciado, presión → tamaño, presión → opacidad y afinado de extremos. Borradores (duro, suave, lápiz, pixel) y difuminar.

**Lápiz óptico:** presión real (S Pen, Wacom, Surface, lápices USI), curva de presión ajustable, modo "solo lápiz" con rechazo de palma, la goma del lápiz borra y el botón lateral toma color. En Ajustes hay un recuadro para probar el lápiz y ver la presión y la inclinación.

**Capas:** ilimitadas, 17 modos de fusión, opacidad, máscara de recorte (clipping), bloqueo de alfa, duplicar, combinar, rellenar, mover arriba y abajo.

**Herramientas:** relleno (con tolerancia, expandir y referencia a todas las capas), degradado lineal y radial, cuentagotas (también manteniendo el dedo quieto, clic derecho o Alt), selección con lazo, rectángulo y varita mágica (nueva, añadir, quitar), transformar (mover, escalar, girar, voltear), texto con contorno, formas (línea, rectángulo, elipse) y mover vista.

**Regla de simetría:** vertical, horizontal, cuádruple, radial y caleidoscopio, con centro movible.

**Filtros con vista previa:** desenfoque gaussiano, tono/saturación/luminosidad, brillo y contraste, niveles, invertir, escala de grises, sepia, posterizar, binarizar, **extraer línea**, mosaico, enfocar, ruido, contorno exterior y resplandor.

**Lienzo y vista:** girar y voltear el lienzo, cambiar tamaño, recortar a la selección, fondo transparente, zoom, giro de la vista con dos dedos, vista en espejo.

**Gestos:** dos dedos para zoom, mover y girar; tocar con dos dedos deshace y con tres rehace.

**Galería:** todos los dibujos se guardan solos en el dispositivo. Exporta en PNG, PNG transparente, JPG o proyecto `.trazo` con todas las capas.

## Atajos de teclado

`B` pincel · `E` borrador · `S` difuminar · `G` relleno · `D` degradado · `I` cuentagotas · `L` selección · `V` transformar · `T` texto · `U` formas · `H` mover vista · `[` `]` tamaño · `X` intercambiar colores · `M` vista en espejo · `R` girar vista · `0` ajustar · `1` 100% · `Espacio` mover vista · `Ctrl+Z` deshacer · `Ctrl+Shift+Z` rehacer · `Ctrl+S` guardar · `Ctrl+A` seleccionar todo · `Ctrl+D` quitar selección · `Ctrl+J` duplicar capa · `Ctrl+E` combinar hacia abajo · `Supr` borrar.

## Desarrollo

```bash
npm install            # dependencias
npm start              # versión web en http://localhost:8080
npm run desktop        # app de escritorio
npm run dist:win       # instalador de Windows (en Windows)
```

Android (requiere Android Studio):

```bash
npm run android:add && npm run android:icons && npm run android:sync
npm run android:open   # abre el proyecto en Android Studio
```

Estructura:

```
www/            la app (HTML, CSS y JS sin compilar)
  js/core.js    utilidades, iconos, preferencias, menús y diálogos
  js/engine.js  documento, capas, composición, historial, selección y vista
  js/brush.js   pinceles, presión, estabilizador, simetría y difuminar
  js/tools.js   relleno, degradado, selección, formas, transformar y texto
  js/filters.js filtros
  js/store.js   galería (IndexedDB), autoguardado y exportar
  js/ui.js      interfaz
  js/input.js   lápiz, dedos, mouse, gestos y teclado
electron/       ventana de escritorio
assets/         iconos para Android
build/          icono de escritorio y firma de Android
```

`build/debug.keystore` es una firma de depuración: sirve para que el APK se pueda actualizar sin desinstalar. Para publicar en Google Play hay que crear una firma propia.
