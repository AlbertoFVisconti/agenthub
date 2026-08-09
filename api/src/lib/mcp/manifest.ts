import { z } from 'zod'

export const McpManifestSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric and dashes only'),
  version: z.string().min(1).regex(/^\d+\.\d+\.\d+$/, 'Version must be semver (e.g. 1.0.0)'),
  description: z.string().min(1).max(200),
  entrypoint: z.array(z.string()).min(1), // e.g. ["node", "index.js"]
  permissions: z.object({
    network: z.boolean().optional(),
  }).optional(),
})

export type McpManifest = z.infer<typeof McpManifestSchema>
