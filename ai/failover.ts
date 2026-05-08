export type StreamProfile = 'chat' | 'title' | 'translate' | 'resolver';

// Shape matches AI SDK's providerOptions.gateway. Object identity is preserved
// per profile (frozen at module load) so callers can rely on referential
// stability and the policy can't be mutated mid-flight.
export type StreamPolicy = {
  models: string[];
};

const CHAT_POLICY: StreamPolicy = { models: ['anthropic/claude-opus-4.6'] };
Object.freeze(CHAT_POLICY.models);
Object.freeze(CHAT_POLICY);

// Profiles absent from this map intentionally have no gateway providerOptions.
// An empty `models` array would be silently no-op per Vercel docs and just adds
// noise to outgoing requests.
const POLICIES: Partial<Record<StreamProfile, StreamPolicy>> = Object.freeze({
  chat: CHAT_POLICY,
});

export function getStreamPolicy(profile: StreamProfile = 'chat'): StreamPolicy | undefined {
  return POLICIES[profile];
}
