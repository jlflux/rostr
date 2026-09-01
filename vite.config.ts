import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const here = (file: string) => fileURLToPath(new URL(file, import.meta.url))

/**
 * Two apps in one repo:
 *   index.html — the staff app (Command Center)
 *   fans.html  — the public school site
 *
 * They share types and helpers but nothing else: the fan bundle contains no
 * admin code. FANS_ONLY=1 builds just the public site, which is what its own
 * Vercel project deploys.
 */
export default defineConfig(() => {
  const fansOnly = process.env.FANS_ONLY === '1'
  const outDir = process.env.VITE_OUT_DIR || 'dist'

  // Deployed on its own, the fan site has to answer at "/", and Vercel serves
  // index.html. Rollup names the output after the source file, so copy it.
  const fansAsIndex: Plugin = {
    name: 'fans-as-index',
    apply: 'build',
    async closeBundle() {
      if (!fansOnly) return
      await copyFile(here(`./${outDir}/fans.html`), here(`./${outDir}/index.html`))
    },
  }

  const input: Record<string, string> = fansOnly
    ? { fans: here('./fans.html') }
    : { index: here('./index.html'), fans: here('./fans.html') }

  return {
    plugins: [react(), fansAsIndex],
    build: { rollupOptions: { input } },
  }
})
