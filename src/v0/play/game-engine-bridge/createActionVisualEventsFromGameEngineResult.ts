import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { createActionVisualEventsFromGameEvents } from "~/v0/play/game-engine-bridge/createActionVisualEventsFromGameEvents";

export namespace createActionVisualEventsFromGameEngineResult {
	export interface Props {
		result: GameEngineResult;
	}
}

export const createActionVisualEventsFromGameEngineResult = ({
	result,
}: createActionVisualEventsFromGameEngineResult.Props): ActionVisualEventSchema.Type[] =>
	createActionVisualEventsFromGameEvents({
		events: result.events,
	});
