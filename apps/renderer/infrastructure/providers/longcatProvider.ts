import OpenAI from 'openai';
import { ProviderId } from '@/shared/types/chat';
import { t } from '@/shared/utils/i18n';
import { getDefaultLongcatBaseUrl, resolveBaseUrl } from '@/infrastructure/providers/baseUrl';
import { PROVIDER_CONFIGS } from '@/infrastructure/providers/providerConfig';
import { OpenAIStandardProviderBase } from '@/infrastructure/providers/openaiStandardProviderBase';
import { buildProviderModelConfig } from '@/infrastructure/providers/modelConfig';
import { ProviderChat } from '@/infrastructure/providers/types';

export const LONGCAT_PROVIDER_ID: ProviderId = 'longcat';

const { defaultModel: DEFAULT_LONGCAT_MODEL } = buildProviderModelConfig(
  PROVIDER_CONFIGS[LONGCAT_PROVIDER_ID].modelSpec
);

const DEFAULT_LONGCAT_API_KEY = PROVIDER_CONFIGS[LONGCAT_PROVIDER_ID].envApiKeyResolver();

class LongcatProvider extends OpenAIStandardProviderBase implements ProviderChat {
  private baseUrl: string;

  constructor() {
    super({
      id: LONGCAT_PROVIDER_ID,
      defaultModel: DEFAULT_LONGCAT_MODEL,
      defaultApiKey: DEFAULT_LONGCAT_API_KEY,
      missingApiKeyError: t('settings.provider.error.longcat.missingApiKey'),
      logLabel: 'LongCat',
    });
    this.baseUrl = getDefaultLongcatBaseUrl();
  }

  protected createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: this.baseUrl,
      dangerouslyAllowBrowser: true,
    });
  }

  getBaseUrl(): string | undefined {
    return this.baseUrl;
  }

  setBaseUrl(baseUrl?: string): void {
    const nextUrl = baseUrl?.trim() ? resolveBaseUrl(baseUrl.trim()) : getDefaultLongcatBaseUrl();
    if (nextUrl !== this.baseUrl) {
      this.baseUrl = nextUrl;
      this.client = null;
    }
  }
}

export const createProviderInstance = (): ProviderChat => new LongcatProvider();
