import * as core from 'core'

enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

type FileStat = {
  type: FileType
  size: number
}

type RemoteFileSystem = {
  readFile(uri: string): Promise<Uint8Array>
  readDirectory(uri: string): Promise<[string, FileType][]>
  stat(uri: string): Promise<FileStat>
}

class CoreFs implements RemoteFileSystem {
  private static coreFs: CoreFs | undefined
  scheme: string = 'moonbit-core'

  static getCoreFs(): CoreFs {
    if (CoreFs.coreFs === undefined) {
      CoreFs.coreFs = new CoreFs()
    }
    return CoreFs.coreFs
  }

  private constructor() {}

  async readFile(uri: string): Promise<Uint8Array> {
    const path = new URL(uri).pathname
    let content = core.coreMap[path]
    if (content === undefined) {
      const compressedContent = core.coreMap[`${path}.gz`]
      if (compressedContent === undefined) {
        throw new Error(`file ${uri.toString()} no found`)
      }
      const blob = new Blob([compressedContent], {
        type: 'application/octet-stream',
      })
      const ungzip = new DecompressionStream('gzip')
      const resp = new Response(blob.stream().pipeThrough(ungzip))
      const arrayBuffer = await resp.arrayBuffer()
      content = new Uint8Array(arrayBuffer)
      core.coreMap[path] = content
      delete core.coreMap[`${path}.gz`]
    }
    return content
  }

  async readDirectory(_uri: string): Promise<[string, FileType][]> {
    throw new Error('Method not implemented.')
  }

  async stat(uri: string): Promise<FileStat> {
    const path = new URL(uri).pathname
    const content = core.coreMap[path]
    if (content === undefined) {
      throw new Error(`File ${uri} not found`)
    }
    return {
      size: content.length,
      type: FileType.File,
    }
  }
}

export { CoreFs }
