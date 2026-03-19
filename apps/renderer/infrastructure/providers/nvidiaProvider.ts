import OpenAI from 'openai';
import { ProviderId } from '@/shared/types/chat';
import { PROVIDER_CONFIGS } from '@/infrastructure/providers/providerConfig';
import { OpenAIStandardProviderBase } from '@/infrastructure/providers/openaiStandardProviderBase';
import { buildProviderModelConfig } from '@/infrastructure/providers/modelConfig';
import { ProviderChat } from '@/infrastructure/providers/types';

export const NVIDIA_PROVIDER_ID: ProviderId = 'nvidia';
const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';

const { defaultModel: DEFAULT_NVIDIA_MODEL } = buildProviderModelConfig(
  PROVIDER_CONFIGS[NVIDIA_PROVIDER_ID].modelSpec
);

const DEFAULT_NVIDIA_API_KEY = PROVIDER_CONFIGS[NVIDIA_PROVIDER_ID].envApiKeyResolver();

class NvidiaProvider extends OpenAIStandardProviderBase implements ProviderChat {
  constructor() {
    super({
      id: NVIDIA_PROVIDER_ID,
      defaultModel: DEFAULT_NVIDIA_MODEL,
      defaultApiKey: DEFAULT_NVIDIA_API_KEY,
      missingApiKeyError: 'Missing NVIDIA_API_KEY',
      logLabel: 'NVIDIA',
    });
  }

  protected createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: NVIDIA_BASE_URL,
      dangerouslyAllowBrowser: true,
    });
  }
}

export const createProviderInstance = (): ProviderChat => new NvidiaProvider();
