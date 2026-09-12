declare module 'yauzl' {
  export interface Options {
    lazyEntries?: boolean;
    validateEntrySizes?: boolean;
  }

  export interface Entry {
    fileName: string;
    generalPurposeBitFlag: number;
    uncompressedSize: number;
    compressedSize: number;
  }

  export interface ZipFile {
    readEntry(): void;
    close(): void;
    on(event: 'entry', handler: (entry: Entry) => void): this;
    on(event: 'end', handler: () => void): this;
    on(event: 'error', handler: (error: Error) => void): this;
  }

  const yauzl: {
    fromBuffer(
      buffer: Buffer,
      options: Options,
      callback: (error: Error | null, zip: ZipFile | undefined) => void,
    ): void;
  };
  export default yauzl;
}