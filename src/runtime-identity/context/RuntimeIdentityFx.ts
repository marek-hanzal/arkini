import { Context, Effect } from "effect";

/** Opaque runtime identities must stay fresh even inside seeded gameplay rolls.
 * Keep their entropy separate from Effect Random; the host UUID implementation
 * also avoids hashing a CUID fingerprint for every spawned item and revision.
 */
export const RuntimeIdentityFx = Context.Reference<Effect.Effect<string>>("RuntimeIdentityFx", {
	defaultValue: () => Effect.sync(() => crypto.randomUUID()),
});
