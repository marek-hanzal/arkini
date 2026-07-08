import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameLineDefinition } from "~/config/GameItemCapabilities";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { readProducerJobLine } from "~/producer/readProducerJobLine";

export const readLiveProducerLineFx = Effect.fn("readLiveProducerLineFx")(function* ({
	config,
	liveJob,
	save,
}: {
	config: GameConfig;
	liveJob: GameSaveProducerJob;
	save: GameSave;
}) {
	const line = readProducerJobLine({
		config,
		job: liveJob,
		save,
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
