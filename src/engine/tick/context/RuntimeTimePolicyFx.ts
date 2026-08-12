import { Context, Effect } from "effect";

import { isInstantGameplayEnabledFx } from "~/engine/cheat/read/isInstantGameplayEnabledFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export interface RuntimeTimePolicyFxService {
	readonly completeTimedWorkInstantly: (props: {
		readonly runtime: RuntimeSchema.Type;
	}) => Effect.Effect<boolean>;
	readonly shouldAdvanceTemporaryItem: (props: {
		readonly item: RuntimeItemSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}) => Effect.Effect<boolean>;
}

/** Owns time acceleration while preserving authored durations in runtime state. */
export const RuntimeTimePolicyFx = Context.Reference<RuntimeTimePolicyFxService>(
	"RuntimeTimePolicyFx",
	{
		defaultValue: () => ({
			completeTimedWorkInstantly: ({ runtime }) =>
				isInstantGameplayEnabledFx({
					runtime,
				}),
			shouldAdvanceTemporaryItem: () => Effect.succeed(true),
		}),
	},
);

export type RuntimeTimePolicyFx = typeof RuntimeTimePolicyFx;
