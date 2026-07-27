// The frontend talks to exactly one origin — the API gateway — which routes to
// the individual services. This is the payoff of the gateway: one public URL,
// one CORS surface, one place for rate limiting.
export const gatewayUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
