import fs from 'node:fs'
import path from 'node:path'

/**
 * Manages the agent's scoped access to a local project directory.
 */
export class ProjectWorkspace {
  public readonly rootPath: string
  private readonly realRoot: string

  constructor(rootPath: string) {
    if (!fs.existsSync(rootPath)) {
      throw new Error(`Workspace root does not exist: ${rootPath}`)
    }
    const stat = fs.statSync(rootPath)
    if (!stat.isDirectory()) {
      throw new Error(`Workspace root is not a directory: ${rootPath}`)
    }
    
    this.rootPath = path.resolve(rootPath)
    this.realRoot = fs.realpathSync(this.rootPath)
  }

  private isInsideRoot(testPath: string): boolean {
    return testPath === this.realRoot || testPath.startsWith(this.realRoot + path.sep)
  }

  /**
   * Resolves a requested path and ensures it does not escape the workspace root.
   * Prevents `../` string traversal and symlink breakouts.
   * 
   * @param targetPath Relative or absolute path requested by the tool.
   * @param mustExist If true, throws if the resolved path does not exist.
   * @returns The absolute, verified real path (or intended path if it doesn't exist yet and mustExist is false).
   */
  resolvePath(targetPath: string, mustExist = false): string {
    // 1. Resolve string-wise against the root
    const absoluteTarget = path.resolve(this.rootPath, targetPath)
    
    // String-based check first (prevents naive traversal)
    if (!this.isInsideRoot(absoluteTarget)) {
      throw new Error(`Path validation failed: ${targetPath} attempts to escape the workspace root.`)
    }

    // 2. Check existence
    const exists = fs.existsSync(absoluteTarget)
    if (mustExist && !exists) {
      throw new Error(`File or directory does not exist: ${targetPath}`)
    }

    // 3. Symlink resolution (if it exists)
    let finalPath = absoluteTarget
    if (exists) {
      finalPath = fs.realpathSync(absoluteTarget)
      // Confirm the real path is still inside the real root
      if (!this.isInsideRoot(finalPath)) {
        throw new Error(`Path validation failed: ${targetPath} resolves to a symlink outside the workspace root.`)
      }
    } else {
      // If it doesn't exist (e.g. creating a new file), we verify the parent directory
      // to ensure we aren't following a symlink in the parent chain outside the root.
      const parentDir = path.dirname(absoluteTarget)
      if (fs.existsSync(parentDir)) {
        const realParent = fs.realpathSync(parentDir)
        if (!this.isInsideRoot(realParent)) {
          throw new Error(`Path validation failed: parent directory of ${targetPath} resolves outside the workspace root.`)
        }
      } else {
         // Deeply nested new directories? We'd need to walk up until we find an existing parent.
         // For now, let's walk up to the first existing parent.
         let current = parentDir
         while (!fs.existsSync(current) && current !== this.realRoot && current !== path.parse(current).root) {
           current = path.dirname(current)
         }
         if (fs.existsSync(current)) {
           const realParent = fs.realpathSync(current)
           if (!this.isInsideRoot(realParent)) {
             throw new Error(`Path validation failed: ancestor directory of ${targetPath} resolves outside the workspace root.`)
           }
         }
      }
    }

    return finalPath
  }
}
