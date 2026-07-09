import { Effect } from "effect";
import { readLineDefinition } from "~/config/GameItemCapabilities";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { LineStartDefinition, LineStartSelection } from "~/producer/LineStartReadinessTypes";

export const readLineStartDefinitionFx = Effect.fn(
	"checkLineStartReadinessFx.readLineStartDefinitionFx",
)(function* (selection: LineStartSelection) {
	const line = readLineDefinition({
		producerDefinition: selection.producerDefinition,
		lineId: selection.lineId,
	});
	if (!line) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Missing line "${selection.lineId}" on producer "${selection.producerId}".`,
			),
		);
	}

	return {
		...selection,
		line,
		lineInputs: line.inputs ?? [],
	} satisfies LineStartDefinition;
});
