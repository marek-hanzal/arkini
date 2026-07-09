import type { GameAudioPlanContext } from "~/audio/GameAudioPlanContext";
import { isStaticGameAudioEvent } from "~/audio/isStaticGameAudioEvent";
import { pushNonStaticGameAudioEvent } from "~/audio/pushNonStaticGameAudioEvent";
import { pushStaticGameAudioEvent } from "~/audio/pushStaticGameAudioEvent";
import type { GameEvent } from "~/event/GameEventSchema";

export const pushGameAudioEvent = (context: GameAudioPlanContext, event: GameEvent) => {
	if (isStaticGameAudioEvent(event)) {
		pushStaticGameAudioEvent(context, event);
		return;
	}

	pushNonStaticGameAudioEvent(context, event);
};
