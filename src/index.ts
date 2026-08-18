/**
 * dsh-minimal-anchor
 *
 * Cordis plugin for DeepSeek Harness (dsh). On a scope's first
 * `system-prompt/assemble` pass only, prunes the tool schema list down to a
 * safe exploration whitelist and prepends a short structural preamble; every
 * later turn passes through untouched.
 */

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { PromptAssembly, AssembleContext } from '@deepseek-ai/dsh-system-prompt'

export const name = 'dsh-minimal-anchor'
export const inject = ['systemPrompt']

export interface Config {
  whitelistedTools: string[]
  enforcePreamble: boolean
  customPreamble: string
}

export const Config: z<Config> = z.object({
  whitelistedTools: z.array(z.string()).default(['read', 'glob', 'grep']),
  enforcePreamble: z.boolean().default(true),
  customPreamble: z.string().default(
    'SYSTEM INITIALIZATION MODE: You are operating in clean execution state. ' +
      'Focus purely on codebase exploration, file verification, and structural logical planning. ' +
      'Avoid verbose commentary or unrequested refactors until core context is established.',
  ),
})

export const PREAMBLE_SECTION_NAME = 'dsh-minimal-anchor:preamble'

/**
 * Pure transform: prune `assembly.tools` to the whitelist and, if enabled,
 * unshift the preamble section. Mutates and returns the same assembly object
 * (matching PromptAssembly's mutable-in-place shape), split out from the
 * Cordis event handler so it's testable without booting a Context.
 */
export function applyAnchor(assembly: PromptAssembly, config: Config): PromptAssembly {
  assembly.tools = assembly.tools.filter((tool) => config.whitelistedTools.includes(tool.name))

  if (config.enforcePreamble) {
    assembly.sections = [
      { name: PREAMBLE_SECTION_NAME, text: config.customPreamble },
      ...assembly.sections,
    ]
  }

  return assembly
}

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger('dsh-minimal-anchor')

  // Scope identity is stable for an agent's lifetime; a WeakSet needs no
  // explicit teardown hook because entries die with their scope key.
  const seenScopes = new WeakSet<object>()

  ctx.on('system-prompt/assemble', async (
    assembly: PromptAssembly,
    context: AssembleContext,
    next: () => Promise<PromptAssembly>,
  ) => {
    const scopeKey = context.scope
    const isFirstTurn = scopeKey !== undefined && !seenScopes.has(scopeKey)

    if (scopeKey !== undefined) seenScopes.add(scopeKey)

    if (!isFirstTurn) {
      return next()
    }

    logger.info('First assembly for scope — applying minimal anchor.')
    const originalCount = assembly.tools.length
    applyAnchor(assembly, config)
    logger.info(`Pruned tool schema: ${originalCount} -> ${assembly.tools.length} primitives.`)

    // Standard Cordis waterfall shape: mutate the assembly, then hand off to
    // the next listener/default via next() — matches dsh-system-prompt's own
    // invariant.js usage (`return await next()`).
    return next()
  })
}
