/** Hand-written strict Typert manifest for the `dshShare` Remote. */
import type { TypertContribution } from '@deepseek-ai/dsh-typert-registry/types'
import { DSH_SHARE_INVOCATIONS } from './contract.ts'

/** Host manifest registered by the plugin body. */
export const TYPERT_MANIFEST: TypertContribution = {
  package: 'dsh-share',
  face: 'host',
  schemas: [],
  model: {
    services: [
      {
        key: 'dshShare',
        exportName: 'DshShareRuntime',
        description: 'Render a privacy-first local document from one validated Session.',
        tags: [],
        members: [
          {
            kind: 'method',
            name: 'render',
            signature: 'render(request: ShareRequest, signal?: AbortSignal): Promise<ShareResult>',
          },
        ],
        types: [],
      },
    ],
    events: [],
    objects: [],
  },
  invocations: DSH_SHARE_INVOCATIONS,
}
