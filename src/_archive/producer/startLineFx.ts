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

	const preparedInputs = yield* prepareLineStartInputsFx({
		action: props.action,
		checked,
		nowMs: props.nowMs,
		save: props.save,
	});
	if (!preparedInputs.ready) {
		return yield* createGameEngineResultFx({
			config: props.config,
			events: preparedInputs.events,
			nowMs: props.nowMs,
			save: preparedInputs.nextSave,
		});
	}

	const started = yield* startQueuedLineJobFx({
		action: props.action,
		checked,
		config: props.config,
		nextSave: preparedInputs.nextSave,
		nowMs: props.nowMs,
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
