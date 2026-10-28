import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const code = readFileSync(new URL('../src/lib/wrappedPalettes.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { emailWrappedPalettes, chooseWrappedPalettes } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

test('profile palettes are stable and normalize email case and whitespace', () => {
  const palettes = emailWrappedPalettes('member@example.com')
  assert.deepEqual(palettes, [0, 2, 2, 0, 1, 2, 1, 2, 1])
  assert.deepEqual(emailWrappedPalettes('member@example.com'), palettes)
  assert.deepEqual(emailWrappedPalettes(' Member@Example.COM '), palettes)
  assert.equal(palettes.length, 9)
  assert.ok(palettes.every(value => Number.isInteger(value) && value >= 0 && value < 3))
})

test('different profiles can receive different palette combinations', () => {
  assert.notDeepEqual(emailWrappedPalettes('member@example.com'), emailWrappedPalettes('another@example.com'))
})

test('guest palettes still change for every card on refresh', () => {
  for (const old of [0, 1, 2]) {
    for (const random of [0, .99]) {
      const palettes = chooseWrappedPalettes(Array(9).fill(old), () => random)
      assert.ok(palettes.every(value => value !== old && value >= 0 && value < 3))
    }
  }
})
