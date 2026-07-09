import type { GameEffect } from "~/config/readGameConfigEffects";

const ownedGrantEffectIdPrefix = "effect:grant-owned:";
const ownedGrantIdPrefix = "grant:owned:";

const isOwnedGrantEffect = (effect: GameEffect) =>
	effect.id.startsWith(ownedGrantEffectIdPrefix) ||
	effect.grants.every((grant) => grant.id.startsWith(ownedGrantIdPrefix));

export const isPlayerVisibleGeneratedEffect = (effect: GameEffect) => !isOwnedGrantEffect(effect);
