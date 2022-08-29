import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'path'

import mdPlugin from 'vite-plugin-markdown'
import markdownIt from 'markdown-it'
import mdPluginGithubHeadings from 'markdown-it-github-headings';
import staticComponentsPlugin from './src/plugins/static-components';

// uncommitted (per-machine) options .. make a file per below that exports an object 
const localConfig = await import('./vite.config.local.js').then(e => e.default).catch(() => {});

// check if being built for production
const isDevMode = process.env.NODE_ENV !== 'production';

// https://vitejs.dev/config/
export default ({ mode }) => {
  
  // [!] IMPORTANT [!]
  // - check to see a (vital) auth secret key has been set
  // - if not we'll throw a big-ol error
  const { VITE_AUTH_SECRET_KEY } = loadEnv(mode, process.cwd());
  if (!VITE_AUTH_SECRET_KEY) {
    throw new Error(`

❌ [auth] "VITE_AUTH_SECRET_KEY" is not defined
    - please set it in "env.local", for more information:
      > .env.local.example
      > src/worker/auth/index.js
    `);
  }

  return defineConfig({
    publicDir: 'routes',
    build: {
      // we're using wrangler / built code for dev, so don't minify here
      minify: isDevMode ? false : true,
      target: 'esnext',
      // watch folders during dev (see package.json > scripts > build:dev)
      watch: isDevMode ? {} : null,
      rollupOptions: {
        input: ['src/_worker.js', 'src/style/styles.scss'],
        preserveEntrySignatures: 'strict',
        output: {
          preferConst: true,
          // we're using cloudflare pages, so ensure _worker.js sits at the project root
          entryFileNames: '[name].js',
          // this is our public folder
          assetFileNames: 'public/[name].[ext]',
        },
      },
    },
    plugins: [
      // very simple custom plugin to import static html 'components'
      // into html, at build time, using <slot data-static-href="{path}" /> 
      staticComponentsPlugin(),

      // converts markdown to html and 'table of contents' (toc) for the api
      mdPlugin.plugin({
        mode: ['html', 'toc'],
        markdownIt: markdownIt({
          html: true,
          breaks: true,
          linkify: true,
          typographer: true,
        })
        .use(mdPluginGithubHeadings, {
          prefixHeadingIds: false,
          enableHeadingLinkIcons: false,
        }),
      }),
    ],
    ...localConfig,
  });
}
