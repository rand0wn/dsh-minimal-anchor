import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyAnchor, Config, PREAMBLE_SECTION_NAME } from './index.js'
import type { PromptAssembly } from '@deepseek-ai/dsh-system-prompt'

function makeAssembly(toolNames: string[]): PromptAssembly {
  return {
    sections: [{ name: 'deployment:persona', text: 'You are helpful.' }],
    contexts: [],
    tools: toolNames.map((name) => ({ name, description: '', parameters: {} }) as never),
    variables: {},
  }
}

test('prunes tools down to the whitelist', () => {
  const config = Config()
  const assembly = makeAssembly(['read', 'write', 'edit', 'bash', 'glob', 'grep'])

  applyAnchor(assembly, config)

  assert.deepEqual(
    assembly.tools.map((t) => t.name).sort(),
    ['glob', 'grep', 'read'],
  )
})

test('keeps only tools present in both the assembly and the whitelist', () => {
  const config = Config()
  const assembly = makeAssembly(['write', 'bash'])

  applyAnchor(assembly, config)

  assert.deepEqual(assembly.tools, [])
})

test('prepends the preamble section when enforcePreamble is true', () => {
  const config = Config()
  const assembly = makeAssembly(['read'])

  applyAnchor(assembly, config)

  assert.equal(assembly.sections[0]?.name, PREAMBLE_SECTION_NAME)
  assert.equal(assembly.sections[0]?.text, config.customPreamble)
  assert.equal(assembly.sections[1]?.name, 'deployment:persona')
})

test('skips the preamble when enforcePreamble is false', () => {
  const config = { ...Config(), enforcePreamble: false }
  const assembly = makeAssembly(['read'])

  applyAnchor(assembly, config)

  assert.equal(assembly.sections.length, 1)
  assert.equal(assembly.sections[0]?.name, 'deployment:persona')
})

test('respects a custom whitelist', () => {
  const config = { ...Config(), whitelistedTools: ['bash'] }
  const assembly = makeAssembly(['read', 'bash', 'write'])

  applyAnchor(assembly, config)

  assert.deepEqual(assembly.tools.map((t) => t.name), ['bash'])
})
