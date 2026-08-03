import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Custom plugin: process // INCLUDE: ./file.js comments in main.js
// and inline the file contents. This lets us split the monolith into
// multiple files that share scope (concatenated into one module).
function concatModules() {
  const INCLUDE_RE = /\/\/\s*INCLUDE:\s*(\S+)/g;

  function inlineFile(filePath, depth = 0) {
    if (depth > 10) throw new Error('INCLUDE depth exceeded (circular?)');
    let code = readFileSync(filePath, 'utf-8');
    const dir = dirname(filePath);
    // Replace all INCLUDE comments with file contents (recursive)
    code = code.replace(INCLUDE_RE, (match, relPath) => {
      const absPath = resolve(dir, relPath);
      return inlineFile(absPath, depth + 1);
    });
    return code;
  }

  return {
    name: 'concat-modules',
    transform(code, id) {
      // Only process the main entry file
      if (!id.endsWith('src/main.js')) return null;
      const inlined = inlineFile(id);
      return { code: inlined, map: null };
    },
    // HMR: when an included file changes, reload the page
    handleHotUpdate(ctx) {
      // Check if this file is included by main.js
      // Simple approach: just reload on any src/ file change
      if (ctx.file.includes('/src/')) {
        ctx.server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
  };
}

export default defineConfig({
  plugins: [
    concatModules(),
    viteSingleFile({
      removeViteModuleLoader: true,
      inlinePattern: ['**/*.js', '**/*.css'],
    }),
  ],
  build: {
    outDir: 'dist',
    target: 'es2020',
    minify: 'esbuild',
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
