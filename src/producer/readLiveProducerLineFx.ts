import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameLineDefinition } from "~/config/GameItemCapabilities";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { readProducerJobLine } from "~/producer/readProducerJobLine";
import type { ProducerJobCompletionScope } from "~/producer/ProducerJobCompletionTypes";

export const readLiveProducerLineFx = Effect.fn("readLiveProducerLineFx")(function* ({
	liveJob,
	scope,
}: {
	liveJob: GameSaveProducerJob;
	scope: ProducerJobCompletionScope;
}) {
	const line = readProducerJobLine({
		config: scope.config,
		job: liveJob,
		save: scope.save,
	});
	if (line) return line;

	return yield* Effect.fail(
		GameEngineError.configReferenceMissing(`Missing line "${liveJob.lineId}".`),
	);
});

export const assertProducerLinePlacementSupportedFx = Effect.fn(
	"assertProducerLinePlacementSupportedFx",
)(function* (line: GameLineDefinition) {
	yield* match(line.placement)
		.with("board_then_inventory", () => Effect.void)
		.exhaustive();
});
