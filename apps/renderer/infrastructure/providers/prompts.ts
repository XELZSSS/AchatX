import { ProviderId } from '@/shared/types/chat';
import { PROVIDER_CONFIGS } from '@/infrastructure/providers/providerConfig';
import { supportsProviderChatAgent } from '@/infrastructure/providers/capabilities';

export type ChatAgentPromptParts = {
  identity: string;
  role: string;
  setting: string;
};

export const buildChatAgentPrompt = (parts: ChatAgentPromptParts): string => {
  return [parts.identity, parts.role, parts.setting]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n');
};

export const CHAT_AGENT_PROMPT_PARTS: ChatAgentPromptParts = {
  identity: '你是一个AI 聊天智能体，表达自然、友好、像真人交流。',
  role: '回答必须逻辑清晰、严谨可信：优先给要点或步骤。',
  setting: [
    '遇到不确定的内容，明确说明不确定，并提出最少必要的澄清问题。',
    '不要糊弄用户，不要空话套话，不要堆砌无用内容。',
    '除非用户要求展开，否则保持简洁。',
    '不要声称执行了未执行的操作。',
  ].join('\n'),
};

export const GEMINI_CHAT_AGENT_PROMPT_PARTS: ChatAgentPromptParts = {
  identity: '你是 AXCHAT 的 Gemini 专属智能体，表达自然、友好、像真人交流。',
  role: '回答必须逻辑清晰、层次分明：优先给结论或步骤，再补充原因。',
  setting: [
    '遇到不确定的内容，明确说明不确定，并提出最少必要的澄清问题。',
    '需要外部信息时，先说明假设或建议使用搜索工具。',
    '不要糊弄用户，不要空话套话，不要堆砌无用内容。',
    '除非用户要求展开，否则保持简洁。',
    '不要声称执行了未执行的操作。',
  ].join('\n'),
};

export const CHAT_AGENT_PROMPT = buildChatAgentPrompt(CHAT_AGENT_PROMPT_PARTS);
export const GEMINI_CHAT_AGENT_PROMPT = buildChatAgentPrompt(GEMINI_CHAT_AGENT_PROMPT_PARTS);

const getChatAgentPromptPreset = (providerId: ProviderId): 'default' | 'gemini' => {
  return PROVIDER_CONFIGS[providerId].chatAgentPromptPreset ?? 'default';
};

export const getDefaultChatAgentPromptPartsForProvider = (
  providerId: ProviderId
): ChatAgentPromptParts => {
  return getChatAgentPromptPreset(providerId) === 'gemini'
    ? GEMINI_CHAT_AGENT_PROMPT_PARTS
    : CHAT_AGENT_PROMPT_PARTS;
};

export const getDefaultChatAgentPromptForProvider = (providerId: ProviderId): string => {
  return getChatAgentPromptPreset(providerId) === 'gemini'
    ? GEMINI_CHAT_AGENT_PROMPT
    : CHAT_AGENT_PROMPT;
};

export const buildSystemInstruction = (
  providerId: ProviderId,
  _modelName: string,
  agentEnabled = true,
  agentPrompt = CHAT_AGENT_PROMPT
): string => {
  if (!agentEnabled || !supportsProviderChatAgent(providerId)) {
    return '';
  }
  const trimmed = agentPrompt.trim();
  return trimmed ? trimmed : '';
};

export const parseChatAgentPromptParts = (prompt: string): ChatAgentPromptParts | null => {
  const normalized = prompt.trim();
  if (!normalized) {
    return null;
  }
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const [identity = '', role = '', ...rest] = lines;
  return {
    identity,
    role,
    setting: rest.join('\n').trim(),
  };
};
