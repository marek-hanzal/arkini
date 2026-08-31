import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace isInstantGameplayEnabledFn {
	export interface Props {
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Returns whether the persisted Instant gameplay option is currently effective. */
export const isInstantGameplayEnabledFn = ({ runtime }: isInstantGameplayEnabledFn.Props) =>
	runtime.cheats.enabled && runtime.cheats.instantGameplay;
