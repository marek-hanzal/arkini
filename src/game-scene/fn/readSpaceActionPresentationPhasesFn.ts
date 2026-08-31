import type { GameTransition } from "~/game-session/type/GameSession";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";

type SpaceActionPresentationPhase =
	| {
			readonly kind: "accounting";
			readonly transition: GameTransition;
	  }
	| {
			readonly kind: "space-switch";
			readonly transition: GameTransition;
	  };

/** Keeps the source space visible while earlier facts from one atomic Space action are projected. */
export const readSpaceActionPresentationPhasesFn = (
	transition: GameTransition,
): readonly SpaceActionPresentationPhase[] => {
	const spaceSwitchIndex = transition.events.findIndex(
		(event) => event.type === GameEventEnumSchema.enum.CurrentSpaceChanged,
	);
	if (spaceSwitchIndex <= 0 || transition.previousRuntime === null) {
		return [
			{
				kind: "space-switch",
				transition,
			},
		];
	}

	const accountingRuntime = {
		...transition.runtime,
		currentSpace: transition.previousRuntime.currentSpace,
	};
	return [
		{
			kind: "accounting",
			transition: {
				...transition,
				events: transition.events.slice(0, spaceSwitchIndex),
				runtime: accountingRuntime,
			},
		},
		{
			kind: "space-switch",
			transition: {
				...transition,
				events: transition.events.slice(spaceSwitchIndex),
				previousRuntime: accountingRuntime,
			},
		},
	];
};
