// seek-bzip ships no types and no @types/seek-bzip package exists. Narrow
// declaration covering only the synchronous decode entry point this
// pipeline actually calls.
declare module "seek-bzip" {
  function decode(input: Buffer): Buffer;
  const Bunzip: { decode: typeof decode };
  export = Bunzip;
}
