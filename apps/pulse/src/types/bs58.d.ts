// bs58 v4 ships no type declarations. Standalone ambient module declaration (this file has
// no imports/exports so it stays a script, which is what makes the declaration apply).
declare module "bs58" {
  const bs58: {
    encode(source: Uint8Array | number[]): string;
    decode(str: string): Uint8Array;
  };
  export default bs58;
}
