import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const PROCESS_ENV_KEYS = [
  'API_KEY',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_BASE_URL',
  'OPENAI_COMPATIBLE_API_KEY',
  'OPENAI_COMPATIBLE_MODEL',
  'OPENAI_COMPATIBLE_BASE_URL',
  'XAI_API_KEY',
  'XAI_MODEL',
  'XAI_BASE_URL',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_MODEL',
  'DEEPSEEK_BASE_URL',
  'GLM_API_KEY',
  'GLM_MODEL',
  'GLM_BASE_URL',
  'MINIMAX_API_KEY',
  'MINIMAX_MODEL',
  'MINIMAX_BASE_URL',
  'MOONSHOT_API_KEY',
  'MOONSHOT_MODEL',
  'MOONSHOT_BASE_URL',
  'LONGCAT_API_KEY',
  'LONGCAT_MODEL',
  'LONGCAT_BASE_URL',
  'TAVILY_API_KEY',
  'TAVILY_PROJECT_ID',
  'TAVILY_SEARCH_DEPTH',
  'TAVILY_MAX_RESULTS',
  'TAVILY_TOPIC',
  'TAVILY_INCLUDE_ANSWER',
  'TOOL_CALL_MAX_ROUNDS',
  'MAX_TOOL_CALL_ROUNDS',
] as const;

const buildProcessEnvDefines = (
  env: Record<string, string | undefined>
): Record<string, string> => {
  const defines: Record<string, string> = {};
  for (const key of PROCESS_ENV_KEYS) {
    defines[`process.env.${key}`] = JSON.stringify(env[key]);
  }
  return defines;
};

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const rendererRoot = path.resolve(projectRoot, 'apps/renderer');
const distRoot = path.resolve(projectRoot, 'dist');

const toNormalizedId = (id: string) => id.replaceAll('\\', '/');

const MANUAL_CHUNK_PATTERNS = [
  ['node_modules/@google/genai/', 'sdk-genai'],
  ['node_modules/openai/', 'sdk-openai'],
  ['node_modules/uuid/', 'utils'],
  ['/apps/renderer/infrastructure/providers/geminiProvider', 'provider-gemini'],
  ['/apps/renderer/infrastructure/providers/openaiProvider', 'provider-openai'],
  [
    '/apps/renderer/infrastructure/providers/openaiCompatibleProvider',
    'provider-openai-compatible',
  ],
  ['/apps/renderer/infrastructure/providers/xaiProvider', 'provider-xai'],
  ['/apps/renderer/infrastructure/providers/deepseekProvider', 'provider-deepseek'],
  ['/apps/renderer/infrastructure/providers/glmProvider', 'provider-glm'],
  ['/apps/renderer/infrastructure/providers/minimaxProvider', 'provider-minimax'],
  ['/apps/renderer/infrastructure/providers/moonshotProvider', 'provider-moonshot'],
  ['/apps/renderer/infrastructure/providers/longcatProvider', 'provider-longcat'],
] as const;

const getManualChunkName = (id: string) => {
  const normalizedId = toNormalizedId(id);

  if (
    normalizedId.includes('node_modules/react/') ||
    normalizedId.includes('node_modules/react-dom/')
  ) {
    return 'react';
  }

  return MANUAL_CHUNK_PATTERNS.find(([pattern]) => normalizedId.includes(pattern))?.[1];
};

const buildV1Proxy = (target: string, prefix: string) => ({
  target,
  changeOrigin: true,
  secure: true,
  rewrite: (requestPath: string) => requestPath.replace(new RegExp(`^/${prefix}`), '/v1'),
});

export default defineConfig(({ command, mode }) => {
  const resolvedMode = mode || (command === 'build' ? 'production' : 'development');
  const env = loadEnv(resolvedMode, projectRoot, '');
  const devServerHost = env.VITE_DEV_HOST || '127.0.0.1';

  return {
    root: rendererRoot,
    base: './',
    server: {
      port: 3000,
      host: devServerHost,
      proxy: {
        '/minimax-intl': buildV1Proxy('https://api.minimax.io', 'minimax-intl'),
        '/minimax-cn': buildV1Proxy('https://api.minimaxi.com', 'minimax-cn'),
      },
    },
    plugins: [react()],
    define: {
      __APP_ENV__: JSON.stringify(resolvedMode),
      ...buildProcessEnvDefines({ ...env, API_KEY: env.GEMINI_API_KEY }),
    },
    resolve: {
      alias: {
        '@': rendererRoot,
      },
    },
    build: {
      target: 'es2022',
      modulePreload: {
        polyfill: false,
      },
      outDir: distRoot,
      emptyOutDir: true,
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: getManualChunkName,
        },
      },
    },
  };
});
