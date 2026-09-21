export function canViewSource(tool: any, session: any): boolean {
  if (!tool.verified && tool.ownerId !== session?.userId) {
    return false
  }
  // TODO: once paid tools exist, return true only if the tool is free OR the requesting user has purchased/installed it.
  return true
}
