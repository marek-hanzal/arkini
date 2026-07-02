import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readEffectiveLine } from "~/v0/game/effects/readEffectiveLine";
import { readLineDurationMs } from "~/v0/game/producer/readLineDurationMs";
import { readWorldProducerJobSubjectFx } from "~/v0/game/world/readWorldProducerJobSubjectFx";

export namespace readProducerJobStartGateReadyFx {
	export interface Props {
		config: GameConfig;
		evaluateAtMs: number;
		ignoredProducerJobIds?: ReadonlySet<string>;
		job: GameSaveProducerJob;
		save: GameSave;
	}
}

export const readProducerJobStartGateReadyFx = Effect.fn("readProducerJobStartGateReadyFx")(
	function* ({
		config,
		evaluateAtMs,
		ignoredProducerJobIds,
		job,
		save,
	}: readProducerJobStartGateReadyFx.Props) {
		const subject = yield* readWorldProducerJobSubjectFx({
			config,
			job,
			save,
		});
		const effectiveLine = readEffectiveLine({
			baseDurationMs: readLineDurationMs({
				line: subject.line,
			}),
			config,
			ignoredProducerJobIds,
			nowMs: evaluateAtMs,
			itemInstanceId: job.itemInstanceId,
			line: subject.line,
			lineId: job.lineId,
			save,
		});

		const hasEnabledOutput =
			subject.line.output === undefined || effectiveLine.lootPlan.baseOutput.length > 0;

		return (
			effectiveLine.visible &&
			effectiveLine.startRequirementsReady !== false &&
			hasEnabledOutput &&
			!effectiveLine.blocked
		);
	},
);
