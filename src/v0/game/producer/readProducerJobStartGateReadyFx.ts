import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readEffectiveProducerLine } from "~/v0/game/effects/readEffectiveProducerLine";
import { readProducerLineDurationMs } from "~/v0/game/producer/readProducerLineDurationMs";
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
		const effectiveProducerLine = readEffectiveProducerLine({
			baseDurationMs: readProducerLineDurationMs({
				line: subject.line,
			}),
			config,
			ignoredProducerJobIds,
			nowMs: evaluateAtMs,
			producerItemInstanceId: job.producerItemInstanceId,
			line: subject.line,
			lineId: job.lineId,
			save,
		});

		const hasEnabledOutput =
			subject.line.output === undefined ||
			effectiveProducerLine.lootPlan.baseOutput.length > 0;

		return (
			effectiveProducerLine.visible &&
			effectiveProducerLine.startRequirementsReady !== false &&
			hasEnabledOutput &&
			!effectiveProducerLine.blocked
		);
	},
);
