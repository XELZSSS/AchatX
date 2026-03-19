import OpenAI from 'openai';
import { ProviderId } from '@/shared/types/chat';
import { t } from '@/shared/utils/i18n';
import { ProviderChat } from '@/infrastructure/providers/types';
import {
  getDefaultGlmBaseUrl,
  normalizeBaseUrlForProvider,
} from '@/infrastructure/providers/baseUrl';
import { PreflightMessage, ToolLoopOverrides } from '@/infrastructure/providers/openaiChatHelpers';
import { PROVIDER_CONFIGS } from '@/infrastructure/providers/providerConfig';
import { getProxyAuthHeadersForTarget } from '@/infrastructure/providers/proxy';
import { buildProviderModelConfig } from '@/infrastructure/providers/modelConfig';
import { OpenAIStandardProviderBase } from '@/infrastructure/providers/openaiStandardProviderBase';

export const GLM_PROVIDER_ID: ProviderId = 'glm';

const { defaultModel: DEFAULT_GLM_MODEL } = buildProviderModelConfig(
  PROVIDER_CONFIGS[GLM_PROVIDER_ID].modelSpec
);

const DEFAULT_GLM_API_KEY = PROVIDER_CONFIGS[GLM_PROVIDER_ID].envApiKeyResolver();

const supportsGlmThinking = (modelName: string): boolean => {
  const model = modelName.trim().toLowerCase();
  return model.startsWith('glm-5') || model.startsWith('glm-4.7') || model.startsWith('glm-4.6');
};

const buildGlmThinkingExtraBody = (
  modelName: string,
  enabled: boolean
): Record<string, unknown> | undefined => {
  if (!enabled || !supportsGlmThinking(modelName)) {
    return undefined;
  }

  return {
    thinking: {
      type: 'enabled',
      clear_thinking: false,
    },
  };
};

const extractGlmReasoningContent = (message: PreflightMessage): string | undefined => {
  const directReasoning = message.reasoning_content ?? message.reasoning;
  if (directReasoning?.trim()) {
    return directReasoning;
  }

  const detailReasoning =
    message.reasoning_details
      ?.map((detail) => detail?.text?.trim())
      .filter((detail): detail is string => Boolean(detail)) ?? [];
  return detailReasoning.length ? detailReasoning.join('\n') : undefined;
};

class GlmProvider extends OpenAIStandardProviderBase implements ProviderChat {
  private baseUrl: string;

  constructor() {
    super({
      id: GLM_PROVIDER_ID,
      defaultModel: DEFAULT_GLM_MODEL,
      defaultApiKey: DEFAULT_GLM_API_KEY,
      missingApiKeyError: t('settings.provider.error.glm.missingApiKey'),
      logLabel: 'GLM',
    });
    this.baseUrl = getDefaultGlmBaseUrl();
  }

  protected createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: this.baseUrl,
      dangerouslyAllowBrowser: true,
      defaultHeaders: getProxyAuthHeadersForTarget(this.baseUrl),
    });
  }

  protected getToolLoopOverrides(): ToolLoopOverrides {
    const extraBody = buildGlmThinkingExtraBody(this.modelName, this.reasoningPreference.enabled);
    return {
      ...(extraBody ? { extraBody } : {}),
      getAssistantMessageExtras: (message: PreflightMessage) => {
        const reasoningContent = extractGlmReasoningContent(message);
        return reasoningContent ? { reasoning_content: reasoningContent } : null;
      },
    };
  }

  getBaseUrl(): string | undefined {
    return this.baseUrl;
  }

  setBaseUrl(baseUrl?: string): void {
    const nextUrl = baseUrl?.trim()
      ? normalizeBaseUrlForProvider(this.id, baseUrl.trim())
      : getDefaultGlmBaseUrl();
    if (nextUrl !== this.baseUrl) {
      this.baseUrl = nextUrl;
      this.client = null;
    }
  }
}

export const createProviderInstance = (): ProviderChat => new GlmProvider();
