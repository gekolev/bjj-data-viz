// Background, body ink, accent, accent ink, secondary accent.
export const wrappedPalettes = [
  [['#dbfc57', '#18251a', '#285533', '#ffffff', '#9dc33e'], ['#ff875e', '#37152b', '#5a174c', '#ffffff', '#c64852'], ['#b9d9fc', '#142c54', '#25489a', '#ffffff', '#75a7df']],
  [['#c5a5ff', '#261342', '#351a57', '#fff0d7', '#f0ff7a'], ['#f9a8d4', '#3f1431', '#5e1b47', '#fff4d8', '#d9ff78'], ['#b7f5cf', '#123b31', '#174c3d', '#fff4d8', '#ffe089']],
  [['#222326', '#eff0dc', '#ffa875', '#222326', '#b5f56b'], ['#192d47', '#f4f0dc', '#a8edec', '#192d47', '#f8bfdb'], ['#3d1845', '#fff0e5', '#f9d779', '#3d1845', '#ff9bc2']],
  [['#ffc1cc', '#4d2033', '#722f53', '#ffffff', '#8b3555'], ['#c9b7ff', '#2d1852', '#573585', '#ffffff', '#704690'], ['#f8df83', '#493119', '#684116', '#ffffff', '#825218']],
  [['#b9d9fc', '#173a60', '#183f68', '#ffffff', '#4977a5'], ['#ffc89b', '#4b261b', '#77321e', '#ffffff', '#aa5635'], ['#b9edc5', '#173e2d', '#20563c', '#ffffff', '#47875c']],
  [['#ff946e', '#441f16', '#6c2c1c', '#ffffff', '#7c3422'], ['#e0b7ff', '#3b1a51', '#62307d', '#ffffff', '#794290'], ['#f4ed83', '#353619', '#51551e', '#ffffff', '#737927']],
  [['#f5cf68', '#493617', '#775015', '#ffffff', '#ba8128'], ['#a9e8ea', '#163b40', '#205e66', '#ffffff', '#51a5ae'], ['#ffc1dc', '#4a203c', '#772e5e', '#ffffff', '#b55c93']],
  [['#b6e5d3', '#173f37', '#205a4c', '#ffffff', '#5eab8c'], ['#c6d0ff', '#222e57', '#354a85', '#ffffff', '#798bc9'], ['#ffcfaa', '#4c2d1c', '#754222', '#ffffff', '#b3754c']],
  [['#4b3883', '#f6ebff', '#f5cf68', '#3b285f', '#c4a9ff'], ['#123f3f', '#e8fff2', '#d7fc70', '#173b31', '#7de0cf'], ['#60243d', '#fff0e6', '#ffcc8b', '#4b1b32', '#ff9fba']],
] as const

/** Choose another of each card's three palettes, avoiding its previous selection. */
export function chooseWrappedPalettes(previous: unknown, random = Math.random) {
  return wrappedPalettes.map((_, index) => {
    const old = Array.isArray(previous) ? previous[index] : undefined
    return Number.isInteger(old) && old >= 0 && old < 3
      ? (old + 1 + Math.floor(random() * 2)) % 3
      : Math.floor(random() * 3)
  })
}

/** Versioned, deterministic choices: the same profile email gets the same cards on every device. */
export function emailWrappedPalettes(email: string) {
  const identity = email.trim().toLowerCase()
  return wrappedPalettes.map((_, card) => {
    const seed = `wrapped-palettes-v1:${identity}:${card}`
    let hash = 2166136261
    for (let index = 0; index < seed.length; index++) {
      hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619)
    }
    hash ^= hash >>> 16
    hash = Math.imul(hash, 0x85ebca6b)
    hash ^= hash >>> 13
    hash = Math.imul(hash, 0xc2b2ae35)
    hash ^= hash >>> 16
    return (hash >>> 0) % 3
  })
}

export function wrappedPaletteStyle(card: number, variant: number) {
  const [background, ink, accent, accentInk, secondary] = wrappedPalettes[card][variant]
  return { '--wrap-bg': background, '--wrap-ink': ink, '--wrap-accent': accent, '--wrap-accent-ink': accentInk, '--wrap-secondary': secondary }
}
