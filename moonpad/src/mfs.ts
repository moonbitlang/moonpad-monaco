import * as fs from "@zenfs/core";
import * as core from "core";

enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

type FileTypeLike = {
  isFile: () => boolean;
  isDirectory: () => boolean;
  isSymbolicLink: () => boolean;
};

function toFileType(typeLike: FileTypeLike): FileType {
  return typeLike.isFile()
    ? FileType.File
    : typeLike.isDirectory()
      ? FileType.Directory
      : typeLike.isSymbolicLink()
        ? FileType.SymbolicLink
        : FileType.Unknown;
}

type FileStat = {
  type: FileType;
  size: number;
};

type RemoteFileSystem = {
  readFile(uri: string): Promise<Uint8Array>;
  readDirectory(uri: string): Promise<[string, FileType][]>;
  stat(uri: string): Promise<FileStat>;
};

class MFS implements RemoteFileSystem {
  private static mfs: MFS | undefined;
  coreScheme: string = "moonbit-core";

  static getMFs(): MFS {
    if (MFS.mfs === undefined) {
      MFS.mfs = new MFS();
    }
    return MFS.mfs;
  }

  private constructor() {}

  writeFileSync = fs.writeFileSync;

  async readFile(uri: string): Promise<Uint8Array> {
    const { pathname: path, protocol } = new URL(uri);
    const scheme = protocol.slice(0, -1);
    if (scheme === this.coreScheme) {
      let content = core.coreMap[path];
      if (content === undefined) {
        const compressedContent = core.coreMap[`${path}.gz`];
        if (compressedContent === undefined) {
          throw new Error(`file ${uri.toString()} no found`);
        }
        const blob = new Blob([compressedContent], {
          type: "application/octet-stream",
        });
        const ungzip = new DecompressionStream("gzip");
        const resp = new Response(blob.stream().pipeThrough(ungzip));
        const arrayBuffer = await resp.arrayBuffer();
        content = new Uint8Array(arrayBuffer);
        core.coreMap[path] = content;
        delete core.coreMap[`${path}.gz`];
      }
      return content;
    }
    return fs.readFileSync(path);
  }

  async readDirectory(uri: string): Promise<[string, FileType][]> {
    const path = new URL(uri).pathname;
    const dirents = fs.readdirSync(path, { withFileTypes: true });
    return dirents.map((d) => [d.name, toFileType(d)]);
  }

  async stat(uri: string): Promise<FileStat> {
    const { pathname: path, protocol } = new URL(uri);
    const scheme = protocol.slice(0, -1);
    if (scheme === this.coreScheme) {
      const content = core.coreMap[path];
      if (content === undefined) {
        throw new Error(`File ${uri} not found`);
      }
      return {
        size: content.length,
        type: FileType.File,
      };
    }
    const stat = fs.statSync(path);
    return {
      size: stat.size,
      type: toFileType(stat),
    };
  }
}

export { MFS };
