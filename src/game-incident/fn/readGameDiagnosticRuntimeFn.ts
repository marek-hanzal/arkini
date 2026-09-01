import { toDiagnosticValueFn } from "~/application-diagnostics/fn/toDiagnosticValueFn";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readGameDiagnosticItemReferenceFn } from "~/game-incident/fn/readGameDiagnosticItemReferenceFn";
import type { GameDiagnosticRuntime } from "~/game-incident/type/GameDiagnosticRuntime";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export const readGameDiagnosticRuntimeFn = ({
	config,
	runtime,
}: {
	readonly config: GameConfigSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}): GameDiagnosticRuntime => {
	const readOwnerFn = (runtimeItemId: string) =>
		readGameDiagnosticItemReferenceFn({
			config,
			runtimeItemId,
			runtimes: [
				runtime,
			],
		});
	return {
		currentSpace: runtime.currentSpace,
		cheats: runtime.cheats,
		items: runtime.items.map((item) => ({
			item: readOwnerFn(item.id),
			quantity: item.quantity,
			...(item.remainingCharges === undefined
				? {}
				: {
						remainingCharges: item.remainingCharges,
					}),
			...(item.remainingDurationMs === undefined
				? {}
				: {
						remainingDurationMs: item.remainingDurationMs,
					}),
			location: toDiagnosticValueFn(item.location),
		})),
		jobs: runtime.jobs.map((job) => ({
			jobId: job.id,
			lineId: job.lineId,
			owner: readOwnerFn(job.ownerItemId),
			durationMs: job.durationMs,
			remainingMs: job.remainingMs,
		})),
		queue: runtime.jobQueue.map((request) => ({
			requestId: request.id,
			lineId: request.lineId,
			owner: readOwnerFn(request.ownerItemId),
		})),
		defaultLines: Object.entries(runtime.defaultLineByOwnerItemId)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([runtimeItemId, lineId]) => ({
				owner: readOwnerFn(runtimeItemId),
				lineId,
			})),
	};
};
