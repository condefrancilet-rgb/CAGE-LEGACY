# Cómo mergear `cage-legacy-rework`

La rama está lista para mergear. **No la mergeé** porque el encargo dice que no toque `main`.

## Antes de mergear: comprobalo vos

```sh
git checkout cage-legacy-rework
node dev/run-tests.js        # 189 pruebas · tarda ~5 min
node dev/browser-tests.js    # 77 pruebas en Chromium real · ~4 min · incluye el trinquete del inicio
node dev/metrics.js          # eval 0 · deps externas 0 · scroll 3 · UI.screen 8
```

Las tres tienen que salir con código 0. Si alguna falla, **no mergees**: el mensaje dice
exactamente qué se rompió y en qué pantalla o semilla.

## El merge

```sh
git checkout main
git merge --no-ff cage-legacy-rework -m "Merge: refactor E1-E5 de CAGE LEGACY"
```

`--no-ff` a propósito: deja un punto único al que volver si algo aparece más tarde.
`git revert -m 1 <hash>` deshace la obra entera de un golpe.

**No hay conflictos previstos:** la rama sale de `main` y nadie más tocó el archivo. Si
`main` avanzó, el único fichero que puede chocar es `index-4-blindado.html`; resolvelo
quedándote con la versión de la rama (`git checkout --theirs index-4-blindado.html`) y
volvé a correr las tres suites antes de commitear el merge.

## Qué llevás al mergear

- **`index-4-blindado.html`** — el juego. Un solo fichero, funciona con doble clic, sin red.
- **`dev/`** — todo lo que lo verifica. No hace falta para jugar; hace falta para tocarlo
  sin romperlo. Sólo módulos nativos de Node: no hay `npm install`.

## Si querés mergear SÓLO el juego, sin las herramientas

```sh
git checkout main
git checkout cage-legacy-rework -- index-4-blindado.html
git commit -m "CAGE LEGACY: refactor E1-E5"
```

Funciona, pero perdés las 266 pruebas. **No lo recomiendo:** la mitad de los bugs de esta
obra los encontró una red, no una lectura.
