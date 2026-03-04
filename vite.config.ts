import path from 'path';
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
  'OPENROUTER_API_KEY',
  'OPENROUTER_MODEL',
  'OPENROUTER_BASE_URL',
  'OPENROUTER_SITE_URL',
  'OPENROUTER_APP_NAME',
  'OLLAMA_API_KEY',
  'OLLAMA_MODEL',
  'OLLAMA_BASE_URL',
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
  'IFLOW_API_KEY',
  'IFLOW_MODEL',
  'IFLOW_BASE_URL',
  'TAVILY_API_KEY',
  'TAVILY_PROJECT_ID',
  'TAVILY_SEARCH_DEPTH',
  'TAVILY_MAX_RESULTS',
  'TAVILY_TOPIC',
  'TAVILY_INCLUDE_ANSWER',
  'MINIMAX_PROXY_PORT',
  'MINIMAX_PROXY_HOST',
  'ACHATX_PROXY_TOKEN',
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

const buildV1Proxy = (target: string, prefix: string) => ({
  target,
  changeOrigin: true,
  secure: true,
  rewrite: (requestPath: string) => requestPath.replace(new RegExp(`^/${prefix}`), '/v1'),
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const devServerHost = env.VITE_DEV_HOST || '127.0.0.1';
  return {
    root: path.resolve(__dirname, 'apps/renderer'),
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
      __APP_ENV__: JSON.stringify(mode),
      ...buildProcessEnvDefines({ ...env, API_KEY: env.GEMINI_API_KEY }),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'apps/renderer'),
      },
    },
    build: {
      target: 'es2022',
      modulePreload: {
        polyfill: false,
      },
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'react';
            }
            if (id.includes('node_modules/@google/genai/')) return 'sdk-genai';
            if (id.includes('node_modules/openai/')) return 'sdk-openai';
            if (id.includes('node_modules/lucide-react/')) return 'icons';
            if (id.includes('node_modules/uuid/')) return 'utils';

            if (id.includes('/apps/renderer/services/providers/geminiProvider')) return 'provider-gemini';
            if (id.includes('/apps/renderer/services/providers/openaiProvider')) return 'provider-openai';
            if (id.includes('/apps/renderer/services/providers/openaiCompatibleProvider')) {
              return 'provider-openai-compatible';
            }
            if (id.includes('/apps/renderer/services/providers/openrouterProvider')) {
              return 'provider-openrouter';
            }
            if (id.includes('/apps/renderer/services/providers/ollamaProvider')) return 'provider-ollama';
            if (id.includes('/apps/renderer/services/providers/xaiProvider')) return 'provider-xai';
            if (id.includes('/apps/renderer/services/providers/deepseekProvider')) {
              return 'provider-deepseek';
            }
            if (id.includes('/apps/renderer/services/providers/glmProvider')) return 'provider-glm';
            if (id.includes('/apps/renderer/services/providers/minimaxProvider')) {
              return 'provider-minimax';
            }
            if (id.includes('/apps/renderer/services/providers/moonshotProvider')) {
              return 'provider-moonshot';
            }
            if (id.includes('/apps/renderer/services/providers/iflowProvider')) return 'provider-iflow';

            return undefined;
          },
        },
      },
    },
  };
});
