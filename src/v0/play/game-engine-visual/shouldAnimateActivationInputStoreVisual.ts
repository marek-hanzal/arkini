import type { GameEvent } from "~/v0/game/event/GameEventSchema";

type TargetEvent = Extract<
	GameEvent,
	{
		type: "producer_input.stored" | "craft_input.stored" | "stash.opened";
	}
>;

export namespace shouldAnimateActivationInputStoreVisual {
	export interface Props {
		target: TargetEvent;
	}
}

export const shouldAnimateActivationInputStoreVisual = ({
	target,
}: shouldAnimateActivationInputStoreVisual.Props) =>
	target.type === "stash.opened" || target.quantity > 0;
