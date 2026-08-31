import { Effect } from "effect";

import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";

export const waitFor = async (assertion: () => boolean, timeoutMs = 1_000) => {
	const startedAt = performance.now();
	while (!assertion()) {
		if (performance.now() - startedAt > timeoutMs) {
			throw new Error("Timed out while waiting for the game session.");
		}
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
};

export const emitCompletedEventFx = (jobId: string) =>
	modifyRuntimeFx((runtime) =>
		Effect.succeed([
			undefined,
			runtime,
			[
				{
					type: GameEventEnumSchema.enum.JobCompleted,
					jobId,
					ownerItemId: "owner:listener",
					lineId: "line:listener",
				},
			],
		] as const),
	);
