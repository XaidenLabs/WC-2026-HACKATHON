// The hoisted bs58 (v4) ships no type declarations; this minimal ambient module covers the
// two functions we use for ORA's keypair + on-chain memo signing.
declare module "bs58" {
  const bs58: {
    encode(data: Uint8Array | number[]): string;
    decode(s: string): Uint8Array;
  };
  export default bs58;
}
