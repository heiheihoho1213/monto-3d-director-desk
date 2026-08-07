/// <reference types="vite/client" />

declare module "node:fs" {
  export function readFileSync(path: string | URL, encoding: string): string;
}

declare module "*.glb" {
  const src: string;
  export default src;
}

declare module "*.glb?url" {
  const src: string;
  export default src;
}
