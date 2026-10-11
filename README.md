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

**Pinceles (20):** lápiz, pluma, pluma G, rotulador, caligrafía, marcador, pincel suave, pincel plano, óleo que mezcla colores, pintura en lienzo, aerógrafo, spray, acuarela, crayón, tiza, carboncillo, pluma de brillo, destellos, puntos y pixel. Cada uno con tamaño, opacidad, estabilizador, dureza, espaciado, presión → tamaño, presión → opacidad, afinado de extremos, y forma y ángulo de punta cuando aplica. Borradores (duro, suave, lápiz, pixel), y difuminar, arrastrar color, desenfocar y mezclar colores.

**Lápiz óptico:** presión real (S Pen, Wacom, Surface, lápices USI), curva de presión ajustable, modo "solo lápiz" con rechazo de palma, la goma del lápiz borra y el botón lateral toma color. En Ajustes hay un recuadro para probar el lápiz y ver la presión y la inclinación.

**Capas:** ilimitadas, 17 modos de fusión, opacidad, máscara de recorte (clipping), bloqueo de alfa, duplicar, combinar, rellenar, mover arriba y abajo.

**Herramientas:** relleno (con tolerancia, expandir y referencia a todas las capas), degradado lineal y radial, cuentagotas (también manteniendo el dedo quieto, clic derecho o Alt), selección con lazo, rectángulo y varita mágica (nueva, añadir, quitar), transformar (mover, escalar, girar, voltear), formas (línea, rectángulo, elipse) y mover vista.

**Texto:** 25 fuentes incluidas (funcionan sin internet), vertical, alineación, negrita y cursiva, contorno con su propio color, relleno degradado, sombra, fondo de caja, redondeado o bocadillo, texto curvo, espacio entre letras e interlineado. Las capas de texto se pueden volver a editar y mover sin perder el texto.

**Cámara:** toma una foto o elige una de la galería para dibujar encima, como dibujo nuevo o como capa. "Foto de un boceto → líneas" convierte un dibujo en papel en líneas listas para colorear.

**Lienzos:** tamaños de pantalla del celular, redes sociales (Instagram, historias, YouTube, X), papel A3/A4/A5/B5/Carta/Postal/Manga en 150, 300 o 350 dpi, pixel art y personalizado.

**Regla de simetría:** vertical, horizontal, cuádruple, radial y caleidoscopio, con centro movible.

**Filtros con vista previa:** desenfoque gaussiano, tono/saturación/luminosidad, brillo y contraste, niveles, invertir, escala de grises, sepia, posterizar, binarizar, **extraer línea**, mosaico, enfocar, ruido, contorno exterior y resplandor.

**Lienzo y vista:** girar y voltear el lienzo, cambiar tamaño, recortar a la selección, fondo transparente, zoom, giro de la vista con dos dedos, vista en espejo.

**Gestos:** dos dedos para zoom, mover y girar; tocar con dos dedos deshace y con tres rehace.

**Galería:** todos los dibujos se guardan solos en el dispositivo. Exporta en PNG, PNG transparente, JPG o proyecto `.trazo` con todas las capas.

Comparación detallada con ibisPaint: [docs/comparacion-ibispaint.md](docs/comparacion-ibispaint.md).

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
www/fonts/      fuentes incluidas (licencias OFL/Apache en LICENCIAS.txt)
assets/         iconos para Android
build/          icono de escritorio y firma de Android
```

`build/debug.keystore` es una firma de depuración: sirve para que el APK se pueda actualizar sin desinstalar. Para publicar en Google Play hay que crear una firma propia.
