import test from 'node:test'
import assert from 'node:assert/strict'
import { chartCoordinates } from '../src/lib/chartCoordinates.ts'

const element = (sideways, scale = 1) => ({
  offsetWidth: 800,
  offsetHeight: 300,
  closest: () => sideways ? {} : null,
  getBoundingClientRect: () => ({ left: 20, top: 40, right: 20 + (sideways ? 300 : 800) * scale, width: (sideways ? 300 : 800) * scale, height: (sideways ? 800 : 300) * scale }),
})

test('regular and scaled charts map viewport points to chart coordinates', () => {
  assert.deepEqual(chartCoordinates(element(false), 420, 190), { x: 400, y: 150 })
  assert.deepEqual(chartCoordinates(element(false, 2), 820, 340), { x: 400, y: 150 })
})

test('clockwise landscape charts map corners and interior points correctly', () => {
  assert.deepEqual(chartCoordinates(element(true), 320, 40), { x: 0, y: 0 })
  assert.deepEqual(chartCoordinates(element(true), 20, 840), { x: 800, y: 300 })
  assert.deepEqual(chartCoordinates(element(true), 245, 240), { x: 200, y: 75 })
  assert.deepEqual(chartCoordinates(element(true, 2), 470, 440), { x: 200, y: 75 })
})
