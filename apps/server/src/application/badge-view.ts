// The badge as clients see it: the signed badge, its current state and its public links.

import type { Badge, BadgeState } from "../domain/badge.ts";

export interface BadgeView {
  id: string;
  state: BadgeState;
  payload: Badge["payload"];
  signature: string;
  site: Badge["site"];
  checkedAt: string;
  links: { svg: string; json: string; page: string; key: string };
}

export function toBadgeView(badge: Badge, state: BadgeState, publicOrigin: string, now: Date): BadgeView {
  return {
    id: badge.id,
    state,
    payload: badge.payload,
    signature: badge.signature,
    site: badge.site,
    checkedAt: now.toISOString(),
    links: {
      svg: `${publicOrigin}/badges/${badge.id}.svg`,
      json: `${publicOrigin}/api/badges/${badge.id}`,
      page: `${publicOrigin}/?badge=${badge.id}`,
      key: `${publicOrigin}/.well-known/conform-badge-key.json`,
    },
  };
}
