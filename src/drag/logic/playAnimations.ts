import type { DraggableAnimation } from "~/drag/DraggableAnimation";
import type { ResolvedDraggableAnimation } from "~/drag/ResolvedDraggableAnimation";
import type { RectLike } from "~/play/types";
import { resolveAnimation } from "./resolveAnimation";

export namespace playAnimations {
	export interface Props<ItemId extends string, Kind extends string, Overlay> {
		animations: DraggableAnimation<ItemId, Kind, Overlay>[];
		dragRect: RectLike | null;
		animate(animation: ResolvedDraggableAnimation<ItemId, Kind, Overlay>): Promise<void> | void;
	}
}

export const playAnimations = async <
	ItemId extends string = string,
	Kind extends string = string,
	Overlay = unknown,
>({
	animations,
	dragRect,
	animate,
}: playAnimations.Props<ItemId, Kind, Overlay>) => {
	const resolved = animations
		.map((animation) =>
			resolveAnimation({
				animation,
				dragRect,
			}),
		)
		.filter((animation): animation is ResolvedDraggableAnimation<ItemId, Kind, Overlay> =>
			Boolean(animation),
		);
	await Promise.all(resolved.map((animation) => animate(animation)));
};
