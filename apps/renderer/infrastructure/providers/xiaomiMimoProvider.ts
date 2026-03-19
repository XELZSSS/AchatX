import OpenAI from 'openai';
import { ProviderId } from '@/shared/types/chat';
import { t } from '@/shared/utils/i18n';
import {
  getDefaultXiaomiMimoBaseUrl,
  resolveBaseUrl,
} from '@/infrastructure/providers/baseUrl';
import { PROVIDER_CONFIGS } from '@/infrastructure/providers/providerConfig';
import { OpenAIStandardProviderBase } from '@/infrastructure/providers/openaiStandardProviderBase';
import { buildProviderModelConfig } from '@/infrastructure/providers/modelConfig';
import { ProviderChat } from '@/infrastructure/providers/types';

export const XIAOMI_MIMO_PROVIDER_ID: ProviderId = 'xiaomi-mimo';

const { defaultModel: DEFAULT_XIAOMI_MIMO_MODEL } = buildProviderModelConfig(
  PROVIDER_CONFIGS[XIAOMI_MIMO_PROVIDER_ID].modelSpec
);

const DEFAULT_XIAOMI_MIMO_API_KEY = PROVIDER_CONFIGS[XIAOMI_MIMO_PROVIDER_ID].envApiKeyResolver();

class XiaomiMimoProvider extends OpenAIStandardProviderBase implements ProviderChat {
  private baseUrl: string;

  constructor() {
    super({
      id: XIAOMI_MIMO_PROVIDER_ID,
      defaultModel: DEFAULT_XIAOMI_MIMO_MODEL,
      defaultApiKey: DEFAULT_XIAOMI_MIMO_API_KEY,
      missingApiKeyError: t('settings.provider.error.xiaomiMimo.missingApiKey'),
      logLabel: 'Xiaomi MiMo',
    });
    this.baseUrl = getDefaultXiaomiMimoBaseUrl();
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
    const nextUrl = baseUrl?.trim()
      ? resolveBaseUrl(baseUrl.trim())
      : getDefaultXiaomiMimoBaseUrl();
    if (nextUrl !== this.baseUrl) {
      this.baseUrl = nextUrl;
      this.client = null;
    }
  }
}

export const createProviderInstance = (): ProviderChat => new XiaomiMimoProvider();
