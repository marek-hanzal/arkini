import type { GameEvent } from "~/event/GameEventSchema";

type TargetEvent = Extract<
	GameEvent,
	{
		type: "producer_input.stored" | "craft_input.stored";
	}
>;

export namespace shouldAnimateActivationInputStoreVisual {
	export interface Props {
		target: TargetEvent;
	}
}

export const shouldAnimateActivationInputStoreVisual = ({
	target,
}: shouldAnimateActivationInputStoreVisual.Props) => target.quantity > 0;
