import { t } from '@/shared/utils/i18n';
import type { ChatMessage } from '@/shared/types/chat';

export const REASONING_PANEL_BASE_CLASS =
  'grid w-fit max-w-[min(40rem,100%)] transition-[grid-template-rows,opacity,transform,margin] duration-200 ease-out motion-reduce:transition-none';
export const REASONING_PANEL_OPEN_CLASS = 'mb-3 grid-rows-[1fr] opacity-100 translate-y-0';
export const REASONING_PANEL_CLOSED_CLASS =
  'mb-0 grid-rows-[0fr] opacity-0 -translate-y-0.5 pointer-events-none';
const TOOL_CARD_BASE_CLASS =
  'w-fit max-w-[min(40rem,100%)] rounded-lg border px-3 py-2 text-xs';
const CITATION_CARD_CLASS =
  'rounded-lg border border-[var(--line-1)] bg-[var(--bg-1)]/70 px-3 py-2';
const TOOL_CARD_VARIANT_CLASS = {
  default: 'border-[var(--line-1)] bg-[var(--bg-2)] text-[var(--ink-3)]',
  native:
    'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--text-on-warning)]',
  error:
    'border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--text-on-brand)]',
} as const;

export const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 h-6 px-1" aria-hidden="true">
    <div className="w-1.5 h-1.5 bg-[var(--ink-3)] rounded-full animate-pulse [animation-delay:-0.24s]"></div>
    <div className="w-1.5 h-1.5 bg-[var(--ink-3)] rounded-full animate-pulse [animation-delay:-0.12s]"></div>
    <div className="w-1.5 h-1.5 bg-[var(--ink-3)] rounded-full animate-pulse"></div>
  </div>
);

export const TextContent = ({
  text,
  className,
  as = 'span',
}: {
  text: string;
  className?: string;
  as?: 'span' | 'p' | 'div';
}) => {
  const Component = as;
  return <Component className={className}>{text}</Component>;
};

const getToolToneClassName = ({
  source,
  isError = false,
}: {
  source?: 'custom' | 'native';
  isError?: boolean;
}) => {
  if (isError) return TOOL_CARD_VARIANT_CLASS.error;
  if (source === 'native') return TOOL_CARD_VARIANT_CLASS.native;
  return TOOL_CARD_VARIANT_CLASS.default;
};

const renderToolHeader = ({
  source,
  provider,
  name,
  resultLabel,
}: {
  source?: 'custom' | 'native';
  provider?: string;
  name: string;
  resultLabel?: string;
}) => {
  const sourceLabel =
    source !== 'native'
      ? t('chat.tool.custom')
      : provider === 'openai'
        ? t('chat.tool.native.openai')
        : provider === 'gemini'
          ? t('chat.tool.native.gemini')
          : t('chat.tool.native.generic');

  return resultLabel ? `${sourceLabel} ${resultLabel}: ${name}` : `${sourceLabel}: ${name}`;
};

const formatCitationChunkLabel = (chunkIndex: number) =>
  `${t('chat.citations.chunk')} ${chunkIndex + 1}`;
const formatCitationScoreLabel = (score: number) =>
  `${t('chat.citations.score')} ${score.toFixed(3)}`;
const formatWebCitationLabel = (index: number, title?: string, url?: string) => {
  if (typeof title === 'string' && title.trim().length > 0) return title;
  if (typeof url === 'string' && url.trim().length > 0) return url;
  return `${t('chat.citations.webSource')} ${index + 1}`;
};

export const ToolCallsSection = ({
  toolCalls,
}: {
  toolCalls: NonNullable<ChatMessage['toolCalls']>;
}) => (
  <div className="mb-3 space-y-2">
    {toolCalls.map((toolCall) => (
      <div
        key={toolCall.id}
        className={`${TOOL_CARD_BASE_CLASS} ${getToolToneClassName({ source: toolCall.source })}`}
      >
        <div className="mb-1 font-medium text-[var(--ink-2)]">
          {renderToolHeader({
            source: toolCall.source,
            provider: toolCall.provider,
            name: toolCall.name,
          })}
        </div>
        <TextContent
          as="p"
          text={toolCall.argumentsText}
          className="whitespace-pre-wrap break-words leading-relaxed"
        />
      </div>
    ))}
  </div>
);

export const ToolResultsSection = ({
  toolResults,
}: {
  toolResults: NonNullable<ChatMessage['toolResults']>;
}) => (
  <div className="mb-3 space-y-2">
    {toolResults.map((toolResult) => (
      <div
        key={toolResult.id}
        className={`${TOOL_CARD_BASE_CLASS} ${getToolToneClassName({
          source: toolResult.source,
          isError: toolResult.isError,
        })}`}
      >
        <div className="mb-1 font-medium text-[var(--ink-2)]">
          {renderToolHeader({
            source: toolResult.source,
            provider: toolResult.provider,
            name: toolResult.name,
            resultLabel: t('chat.tool.result'),
          })}
        </div>
        <TextContent
          as="p"
          text={toolResult.outputText}
          className="whitespace-pre-wrap break-words leading-relaxed"
        />
      </div>
    ))}
  </div>
);

export const CitationsSection = ({
  citations,
  areCitationsOpen,
  onToggle,
}: {
  citations: NonNullable<ChatMessage['citations']>;
  areCitationsOpen: boolean;
  onToggle: () => void;
}) => (
  <div className="mt-3 w-full max-w-[min(44rem,100%)] rounded-lg border border-[var(--line-1)] bg-[var(--bg-2)]/50 px-3 py-3">
    <button
      type="button"
      onClick={onToggle}
      className="mb-2 text-left text-xs font-medium text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
    >
      {t('chat.citations.title')} {areCitationsOpen ? t('reasoning.collapse') : t('reasoning.expand')}
    </button>
    {areCitationsOpen && (
      <div className="space-y-2">
        {citations.map((citation, index) => {
          const citationKey =
            citation.chunkId ?? citation.url ?? `${citation.sourceKind ?? 'local'}-${index}`;

          if (citation.sourceKind === 'web') {
            const label = formatWebCitationLabel(index, citation.title, citation.url);
            return (
              <div key={citationKey} className={CITATION_CARD_CLASS}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--ink-2)]">
                  <span className="font-medium">{label}</span>
                  {typeof citation.score === 'number' && (
                    <span className="text-[var(--ink-3)]">{formatCitationScoreLabel(citation.score)}</span>
                  )}
                </div>
                {citation.url && (
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-[11px] text-[var(--action-interactive)] underline break-all"
                  >
                    {citation.url}
                  </a>
                )}
                <TextContent
                  as="p"
                  text={citation.snippet}
                  className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--ink-3)]"
                />
              </div>
            );
          }

          return (
            <div key={citationKey} className={CITATION_CARD_CLASS}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--ink-2)]">
                <span className="font-medium">{citation.documentName}</span>
                {typeof citation.chunkIndex === 'number' && (
                  <span className="text-[var(--ink-3)]">{formatCitationChunkLabel(citation.chunkIndex)}</span>
                )}
                {typeof citation.score === 'number' && (
                  <span className="text-[var(--ink-3)]">{formatCitationScoreLabel(citation.score)}</span>
                )}
              </div>
              {citation.sourcePath && (
                <div className="mt-1 text-[11px] text-[var(--ink-3)] break-all">{citation.sourcePath}</div>
              )}
              <TextContent
                as="p"
                text={citation.snippet}
                className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--ink-3)]"
              />
            </div>
          );
        })}
      </div>
    )}
  </div>
);
