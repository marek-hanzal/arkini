import { Effect } from "effect";
import { assertLineStartInputsReadyFx } from "~/producer/assertLineStartInputsReadyFx";
import { assertLineStartRuntimeReadinessFx } from "~/producer/assertLineStartRuntimeReadinessFx";
import { assertProducerQueueReadyFx } from "~/producer/assertProducerQueueReadyFx";
import type { LineStartReadinessScope } from "~/producer/LineStartReadinessTypes";
import { readLineStartDefinitionFx } from "~/producer/readLineStartDefinitionFx";
import { readLineStartSelectionFx } from "~/producer/readLineStartSelectionFx";

export const checkLineStartReadinessProgramFx = Effect.fn("checkLineStartReadinessFx.programFx")(
	function* (scope: LineStartReadinessScope) {
		const selection = yield* readLineStartSelectionFx(scope);
		yield* assertProducerQueueReadyFx(scope, selection);
		const definition = yield* readLineStartDefinitionFx(selection);
		yield* assertLineStartRuntimeReadinessFx(scope, definition);
		yield* assertLineStartInputsReadyFx(scope, definition);

		return definition;
	},
);
