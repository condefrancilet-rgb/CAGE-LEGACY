# Cómo mergear `cage-legacy-rework`

**La rama de destino de este repo NO es `main`: no existe.** La rama por defecto es
`claude/index-4-blindado-audit-recovery-5w624l`, y ya tiene mergeados el PR #1 (el arreglo
del scroll) y el PR #2 (una versión anterior de esta misma rama). Escribí `main` en la
primera versión de este documento sin comprobarlo; queda corregido.

## Antes de mergear: comprobalo vos

```sh
git checkout cage-legacy-rework
node dev/run-tests.js        # 193 pruebas · tarda ~5 min
node dev/browser-tests.js    # 77 pruebas en Chromium real · ~4 min · incluye el trinquete del inicio
node dev/metrics.js          # eval 0 · deps externas 0 · scroll 3 · UI.screen 8
```

Las tres tienen que salir con código 0. Si alguna falla, **no mergees**: el mensaje dice
exactamente qué se rompió y en qué pantalla o semilla.

## El merge

```sh
DEF=claude/index-4-blindado-audit-recovery-5w624l
git fetch origin $DEF
git checkout -B $DEF origin/$DEF
git merge --no-ff cage-legacy-rework -m "Merge: refactor E1-E5 de CAGE LEGACY"
git push origin $DEF
```

`--no-ff` a propósito: deja un punto único al que volver si algo aparece más tarde.
`git revert -m 1 <hash>` deshace la obra entera de un golpe.

**No hay conflictos previstos:** lo único que la rama por defecto tiene y esta rama no son
dos *commits de merge* de trabajo que ya está contenido acá. Si aun así chocara, el único
fichero posible es `index-4-blindado.html`; resolvelo quedándote con la versión de la rama
(`git checkout --theirs index-4-blindado.html`) y volvé a correr las tres suites antes de
commitear el merge.

## Qué llevás al mergear

- **`index-4-blindado.html`** — el juego. Un solo fichero, funciona con doble clic, sin red.
- **`dev/`** — todo lo que lo verifica. No hace falta para jugar; hace falta para tocarlo
  sin romperlo. Sólo módulos nativos de Node: no hay `npm install`.

## Si querés mergear SÓLO el juego, sin las herramientas

```sh
git checkout claude/index-4-blindado-audit-recovery-5w624l
git checkout cage-legacy-rework -- index-4-blindado.html
git commit -m "CAGE LEGACY: refactor E1-E5"
```

Funciona, pero perdés las 270 pruebas. **No lo recomiendo:** la mitad de los bugs de esta
obra los encontró una red, no una lectura.
