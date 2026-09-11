declare module 'yauzl' {
  const yauzl: {
    fromBuffer(buffer: Buffer, options: object, callback: (error: Error | null, zip: any) => void): void;
  };
  export default yauzl;
}