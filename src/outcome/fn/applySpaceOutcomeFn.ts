import type { ResolvedOutcome } from "~/outcome/type/ResolvedOutcome";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** Navigation is draft state; publication emits only the final space change. */
export const applySpaceOutcomeFn = ({
	outcome,
	runtime,
}: {
	readonly outcome: ResolvedOutcome.Space;
	readonly runtime: RuntimeSchema.Type;
}): RuntimeSchema.Type =>
	runtime.currentSpace === outcome.space
		? runtime
		: {
				...runtime,
				currentSpace: outcome.space,
			};
