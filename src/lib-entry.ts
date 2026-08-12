/**
 * Vite library build entry: loads scoped CSS once, then re-exports the public API.
 * Keep `src/index.ts` free of CSS side effects so published `.d.ts` stay portable.
 */
import "./styles/index.css";

export * from "./index";
export { DirectorDesk as default } from "./DirectorDesk";
