// The dependency does not ship typings, so declare the synchronous API used here.
declare module 'seek-bzip' {
  function decode(input: Buffer): Buffer;
  const Bunzip: { decode: typeof decode };
  export = Bunzip;
}
