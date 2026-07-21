import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Returns whether the persisted Instant gameplay option is currently effective. */
export const isInstantGameplayEnabled = (runtime: RuntimeSchema.Type) =>
	runtime.cheats.enabled && runtime.cheats.instantGameplay;
