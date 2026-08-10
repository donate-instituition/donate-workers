// Mirrors donate-server's src/cache/cache-keys.ts — the stripe-webhook
// handler invalidates the same cache entries donate-server's campaigns/
// institutions services populate, so the key format must stay identical.
export function campaignCacheKey(id: string) {
  return `cache:campaign:${id}`;
}

export function institutionCacheKey(id: string) {
  return `cache:institution:${id}`;
}
