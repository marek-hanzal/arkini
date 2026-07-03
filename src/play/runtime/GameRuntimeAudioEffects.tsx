import { type FC, useEffect } from "react";
import { createGameAudioPlan } from "~/audio/createGameAudioPlan";
import { useGameAudio } from "~/audio/GameAudioProvider";
import type { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";

export namespace GameRuntimeAudioEffects {
	export interface Props {
		store: GameRuntimeStore;
	}
}

export const GameRuntimeAudioEffects: FC<GameRuntimeAudioEffects.Props> = ({ store }) => {
	const audio = useGameAudio();

	useEffect(
		() =>
			store.subscribeUpdate((update) => {
				if (update.result.events.length === 0) return;

				const plan = createGameAudioPlan({
					config: update.current.runtime.config,
					currentSave: update.current.runtime.save,
					events: update.result.events,
					previousSave: update.previous.runtime.save,
				});
				if (plan.entries.length === 0) return;

				audio.playPlan(plan);
			}),
		[
			audio,
			store,
		],
	);

	return null;
};
