import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'path'

import mdPlugin from 'vite-plugin-markdown'
import markdownIt from 'markdown-it'
import mdPluginGithubHeadings from 'markdown-it-github-headings';
import staticComponentsPlugin from './src/plugins/static-components';
import filterOutPlugin from './src/plugins/filter-out';
import fuzzyOutPlugin from './src/plugins/fuzzy-out';
import logger from './src/utils/logger'
const { error } = logger('config');


// uncommitted (per-machine) options .. make a file per below that exports an object 
const localConfig = await import('./vite.config.local.js').then(e => e.default).catch(() => {});

// set our primary content directory for build
// this should include all files for deployment, excluding our worker
const CONTENT_DIR = 'routes';
// set the public dir that sits under our content dir
// this will include any publically accessible content
const CONTENT_PUBLIC_DIR = 'public';
// set the shared dir that sits under our content dir
// this will include content accessible to any authenticated users
const CONTENT_SHARED_DIR = 'shared';
// set the private dir that sits under our content dir
// this will include content accessible only to dir-specific authenticated users
const CONTENT_PRIVATE_DIR = 'private';
// set the component dir to search for any html / markdown fragments
const COMPONENT_DIR = 'src/components';

// https://vitejs.dev/config/
export default ({ mode }) => {

  // check if being built for production
  const isDevMode = mode !== 'production';
  
  // [!] IMPORTANT [!]
  // - check to see a (vital) auth secret key has been set
  // - if not we'll throw a big-ol error
  const { VITE_AUTH_SECRET_KEY } = loadEnv(mode, process.cwd());
  if (!VITE_AUTH_SECRET_KEY) {
    error('"VITE_AUTH_SECRET_KEY" is not defined, see "env.local.example" for more information\n');
    throw new Error('"VITE_AUTH_SECRET_KEY" is not defined');
  }

  return defineConfig({
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    define: {
      // (!) update these values via the constants, above
      // used for "glob" imports in e.g. src/worker/markdown.js, src/worker/auth/index.js
      __CONTENT_DIR__: CONTENT_DIR,
      __CONTENT_PUBLIC_DIR__: CONTENT_PUBLIC_DIR,
      __CONTENT_SHARED_DIR__: CONTENT_SHARED_DIR,
      __CONTENT_PRIVATE_DIR__: CONTENT_PRIVATE_DIR,
      __COMPONENT_DIR__: COMPONENT_DIR,
    },
    // (!) this must match the __CONTENT_DIR__ constant defined above
    publicDir: CONTENT_DIR,
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
      // a very simple custom plugin to import static html 'components'
      // into html, at build time, using <slot href="{path}" /> 
      staticComponentsPlugin(),

      // a very simple custom plugin to filter the files that end up in the deployment dir
      // ... to stop a file being removed, add a relative path to the filter below
      filterOutPlugin({
        filter: [
          '_redirects',
          '_headers',
          '_worker.js',
          '404.html',
          'index.html',
          CONTENT_PUBLIC_DIR,
          CONTENT_SHARED_DIR,
          CONTENT_PRIVATE_DIR,
          `!${CONTENT_PRIVATE_DIR}/*`, // no files directly under the private dir
          '!**/auth.json', // auth files are virtualised in the worker
          '!**/template.html', // template files are only required for build
        ],
        verbose: isDevMode,
        dryRun: isDevMode,
      }),

      // a very simple custom plugin to fuzzy rename sensitive dirs
      // this plugin will run after all others
      fuzzyOutPlugin({
        dirs: {
          CONTENT_SHARED_DIR,
          CONTENT_PRIVATE_DIR,
        },
        verbose: isDevMode,
        dryRun: isDevMode,
      }),

      // drop-in plugin to convert markdown to html and 'table of contents' (toc) for the api
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
