/* global fetch, process, setTimeout */
const { readAppStorageValue } = require('../storage/appStorage.cjs');
const {
  CODE_ASSIST_BASE_URL,
  CODE_ASSIST_HEADERS,
  FREE_TIER_ID,
  LEGACY_TIER_ID,
} = require('./constants.cjs');

const buildGeminiCliUserAgent = (model = 'gemini-code-assist') =>
  `GeminiCLI/0.0.0/${model} (${process.platform}; ${process.arch})`;

const normalizeProjectId = (value) => {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'object' && typeof value.id === 'string') {
    const trimmed = value.id.trim();
    return trimmed || undefined;
  }
  return undefined;
};

const buildMetadata = (projectId, includeDuetProject = true) => {
  const metadata = {
    ideType: 'IDE_UNSPECIFIED',
    platform: 'PLATFORM_UNSPECIFIED',
    pluginType: 'GEMINI',
  };
  if (projectId && includeDuetProject) {
    metadata.duetProject = projectId;
  }
  return metadata;
};

const pickOnboardTier = (allowedTiers) => {
  if (Array.isArray(allowedTiers) && allowedTiers.length > 0) {
    return allowedTiers.find((tier) => tier?.isDefault) ?? allowedTiers[0];
  }
  return { id: LEGACY_TIER_ID, userDefinedCloudaicompanionProject: true };
};

const buildIneligibleTierMessage = (tiers) => {
  if (!Array.isArray(tiers) || tiers.length === 0) return undefined;
  const reasons = tiers
    .map((tier) => (typeof tier?.reasonMessage === 'string' ? tier.reasonMessage.trim() : ''))
    .filter(Boolean);
  return reasons.length > 0 ? reasons.join(', ') : undefined;
};

const throwIfValidationRequired = (tiers) => {
  if (!Array.isArray(tiers) || tiers.length === 0) return;
  const validationTier = tiers.find((tier) => {
    const reasonCode = String(tier?.reasonCode ?? '').trim().toUpperCase();
    return reasonCode === 'VALIDATION_REQUIRED' && String(tier?.validationUrl ?? '').trim();
  });
  if (!validationTier) return;

  const parts = [
    String(validationTier.reasonMessage ?? '').trim() || 'Verify your account to continue.',
  ];
  const validationUrl = String(validationTier.validationUrl ?? '').trim();
  const learnMoreUrl = String(validationTier.validationLearnMoreUrl ?? '').trim();
  if (validationUrl) parts.push(`Complete validation: ${validationUrl}`);
  if (learnMoreUrl) parts.push(`Learn more: ${learnMoreUrl}`);
  throw new Error(parts.join('\n'));
};

const getConfiguredProjectId = () => {
  try {
    const storedProviderSettings = readAppStorageValue('providerSettings');
    if (storedProviderSettings) {
      const parsed = JSON.parse(storedProviderSettings);
      const geminiCliSettings = parsed?.['gemini-cli-auth'];
      const storedCandidates = [
        normalizeProjectId(geminiCliSettings?.geminiCliProjectId),
        normalizeProjectId(geminiCliSettings?.googleCloudProject),
      ];
      for (const candidate of storedCandidates) {
        if (candidate) return candidate;
      }
    }
  } catch {
    return undefined;
  }

  const candidates = [
    process.env.GEMINI_CLI_PROJECT_ID,
    process.env.OPENCODE_GEMINI_PROJECT_ID,
    process.env.GOOGLE_CLOUD_PROJECT,
    process.env.GOOGLE_CLOUD_PROJECT_ID,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeProjectId(candidate);
    if (normalized) return normalized;
  }
  return undefined;
};

const loadManagedProject = async (accessToken, projectId) => {
  try {
    const requestBody = {
      metadata: buildMetadata(projectId),
      ...(projectId ? { cloudaicompanionProject: projectId } : {}),
    };
    const response = await fetch(`${CODE_ASSIST_BASE_URL}:loadCodeAssist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': buildGeminiCliUserAgent(),
        ...CODE_ASSIST_HEADERS,
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      return null;
    }
    return response.json().catch(() => null);
  } catch {
    return null;
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const onboardManagedProject = async (
  accessToken,
  tierId,
  projectId,
  attempts = 10,
  delayMs = 5000
) => {
  const isFreeTier = tierId === FREE_TIER_ID;
  const requestBody = {
    tierId,
    metadata: buildMetadata(projectId, !isFreeTier),
    ...(!isFreeTier && projectId ? { cloudaicompanionProject: projectId } : {}),
  };

  if (!isFreeTier && !projectId) {
    throw new Error(
      'Google Gemini requires a Google Cloud project. Set GEMINI_CLI_PROJECT_ID or GOOGLE_CLOUD_PROJECT.'
    );
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'User-Agent': buildGeminiCliUserAgent(),
    ...CODE_ASSIST_HEADERS,
  };
  const response = await fetch(`${CODE_ASSIST_BASE_URL}:onboardUser`, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) {
    return undefined;
  }

  let payload = await response.json().catch(() => ({}));
  if (!payload?.done && payload?.name) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await wait(delayMs);
      const operationResponse = await fetch(`${CODE_ASSIST_BASE_URL}/${payload.name}`, {
        method: 'GET',
        headers,
      });
      if (!operationResponse.ok) {
        return undefined;
      }
      payload = await operationResponse.json().catch(() => ({}));
      if (payload?.done) break;
    }
  }

  const managedProjectId = normalizeProjectId(payload?.response?.cloudaicompanionProject);
  if (payload?.done && managedProjectId) {
    return managedProjectId;
  }
  if (payload?.done && projectId) {
    return projectId;
  }
  return undefined;
};

const resolveProjectContext = async (session) => {
  const configuredProjectId = getConfiguredProjectId();
  const projectId = configuredProjectId || session.projectId;

  if (!configuredProjectId && (projectId || session.managedProjectId)) {
    return {
      ...session,
      projectId,
      managedProjectId: session.managedProjectId,
      effectiveProjectId: projectId || session.managedProjectId,
    };
  }

  const loadPayload = await loadManagedProject(session.accessToken, projectId);
  if (!loadPayload) {
    return {
      ...session,
      projectId,
      effectiveProjectId: session.managedProjectId || projectId,
    };
  }

  const managedProjectId = normalizeProjectId(loadPayload.cloudaicompanionProject);
  if (managedProjectId) {
    return {
      ...session,
      projectId,
      managedProjectId,
      effectiveProjectId: managedProjectId,
    };
  }

  const currentTierId = String(loadPayload?.currentTier?.id ?? '').trim();
  if (!currentTierId) {
    throwIfValidationRequired(loadPayload?.ineligibleTiers);
  }

  if (currentTierId) {
    if (projectId) {
      return {
        ...session,
        projectId,
        effectiveProjectId: projectId,
      };
    }
    const ineligibleMessage = buildIneligibleTierMessage(loadPayload?.ineligibleTiers);
    if (ineligibleMessage) {
      throw new Error(ineligibleMessage);
    }
    return {
      ...session,
      effectiveProjectId: undefined,
    };
  }

  const tier = pickOnboardTier(loadPayload?.allowedTiers);
  const tierId = String(tier?.id ?? LEGACY_TIER_ID).trim() || LEGACY_TIER_ID;
  const onboardedProjectId = await onboardManagedProject(session.accessToken, tierId, projectId);
  return {
    ...session,
    projectId,
    managedProjectId: onboardedProjectId,
    effectiveProjectId: onboardedProjectId || projectId,
  };
};

module.exports = {
  resolveProjectContext,
};
