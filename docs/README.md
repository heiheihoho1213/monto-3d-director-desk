# Director Desk Docs

Vite playground that consumes the **built** `monto-3d-director-desk` package from `../dist`.

```bash
# from repo root — builds the library first, then starts docs
pnpm install
pnpm build
pnpm --dir docs dev
# or in one step:
pnpm dev:docs
```

Open `http://127.0.0.1:5273/`.

After changing library source, run `pnpm build` again (or restart `pnpm dev:docs`) so docs picks up the new `dist/`.
