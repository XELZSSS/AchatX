import { ProviderId } from '@/shared/types/chat';
import { t } from '@/shared/utils/i18n';
import {
  getDefaultOpenAICompatibleBaseUrl,
  resolveBaseUrl,
} from '@/infrastructure/providers/baseUrl';
import { PROVIDER_CONFIGS } from '@/infrastructure/providers/providerConfig';
import { OpenAIProxyCompatibleProviderBase } from '@/infrastructure/providers/openaiProxyCompatibleProviderBase';
import { buildProxyUrl } from '@/infrastructure/providers/proxy';
import * as proxyConfig from '../../../shared/proxy-config';
import { buildProviderModelConfig } from '@/infrastructure/providers/modelConfig';
import { ProviderChat } from '@/infrastructure/providers/types';

export const OPENAI_COMPATIBLE_PROVIDER_ID: ProviderId = 'openai-compatible';
const OPENAI_COMPATIBLE_PROXY_BASE_URL = buildProxyUrl(proxyConfig.PROXY_ROUTES.openaiCompatibleV1);

const { defaultModel: DEFAULT_OPENAI_COMPATIBLE_MODEL } = buildProviderModelConfig(
  PROVIDER_CONFIGS[OPENAI_COMPATIBLE_PROVIDER_ID].modelSpec
);

const DEFAULT_OPENAI_COMPATIBLE_API_KEY =
  PROVIDER_CONFIGS[OPENAI_COMPATIBLE_PROVIDER_ID].envApiKeyResolver();

class OpenAICompatibleProvider extends OpenAIProxyCompatibleProviderBase implements ProviderChat {
  constructor() {
    super({
      id: OPENAI_COMPATIBLE_PROVIDER_ID,
      defaultModel: DEFAULT_OPENAI_COMPATIBLE_MODEL,
      defaultApiKey: DEFAULT_OPENAI_COMPATIBLE_API_KEY,
      proxyBaseUrl: OPENAI_COMPATIBLE_PROXY_BASE_URL,
      defaultTargetBaseUrl: getDefaultOpenAICompatibleBaseUrl(),
      missingApiKeyError: t('settings.provider.error.openaiCompatible.missingApiKey'),
      missingBaseUrlError: t('settings.provider.error.openaiCompatible.missingBaseUrl'),
      logLabel: 'OpenAI-Compatible',
      supportsTavily: true,
    });
  }

  protected resolveTargetBaseUrl(baseUrl?: string): string | undefined {
    const raw = baseUrl?.trim() || getDefaultOpenAICompatibleBaseUrl();
    if (!raw) return undefined;

    const normalized = resolveBaseUrl(raw);
    try {
      const parsed = new URL(normalized);
      const pathname = parsed.pathname.replace(/\/+$/, '');
      if (pathname === '/v1') {
        parsed.pathname = '';
      }
      return parsed.toString().replace(/\/+$/, '');
    } catch {
      return normalized;
    }
  }

  async generateTitle(message: string): Promise<string> {
    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: this.modelName,
        messages: [
          { role: 'system', content: t('settings.titlePrompt.system') },
          {
            role: 'user',
            content: t('settings.titlePrompt.user').replace('{message}', message),
          },
        ],
        stream: false,
      });
      return response.choices[0]?.message?.content?.trim() ?? '';
    } catch (error) {
      console.error('OpenAI-Compatible title generation error:', error);
      return '';
    }
  }
}

export const createProviderInstance = (): ProviderChat => new OpenAICompatibleProvider();
