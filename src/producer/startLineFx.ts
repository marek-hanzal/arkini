import { Effect } from "effect";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import type { LineStartExecutionProps } from "~/producer/LineStartExecutionTypes";
import { checkLineStartReadinessFx } from "~/producer/checkLineStartReadinessFx";
import { prepareLineStartInputsFx } from "~/producer/prepareLineStartInputsFx";
import { startQueuedLineJobFx } from "~/producer/startQueuedLineJobFx";

export namespace startLineFx {
	export type Props = LineStartExecutionProps;
}

export const startLineFx = Effect.fn("startLineFx")(function* (props: startLineFx.Props) {
	const checked = yield* checkLineStartReadinessFx(props);
	const scope = {
		...props,
		checked,
	};

	const preparedInputs = yield* prepareLineStartInputsFx(scope);
	if (!preparedInputs.ready) {
		return yield* createGameEngineResultFx({
			config: props.config,
			events: preparedInputs.events,
			nowMs: props.nowMs,
			save: preparedInputs.nextSave,
		});
	}

	const started = yield* startQueuedLineJobFx(scope, {
		nextSave: preparedInputs.nextSave,
	});
	return yield* createGameEngineResultFx({
		config: props.config,
		events: [
			...preparedInputs.events,
			...started.events,
		],
		nowMs: props.nowMs,
		save: started.nextSave,
	});
});
