import { animate } from "motion";
import { type RefObject, useLayoutEffect } from "react";
import type { EnterMotionSchema } from "~/v0/play/motion/EnterMotionSchema";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";

export namespace useTileActorEnterMotion {
	export interface Props {
		actorRef: RefObject<HTMLDivElement | null>;
		enter?: EnterMotionSchema.Type;
		tileId: string;
	}
}

export const useTileActorEnterMotion = ({
	actorRef,
	enter,
	tileId,
}: useTileActorEnterMotion.Props) => {
	useLayoutEffect(() => {
		if (!enter) return;

		const element = actorRef.current;
		if (!element) return;

		void animate(
			element,
			{
				opacity: [
					0,
					1,
				],
				transform: [
					"translate3d(0px, 8px, 0px) scale(0.72)",
					"translate3d(0px, 0px, 0px) scale(1)",
				],
			},
			{
				delay: (enter.delayMs ?? 0) / 1000,
				duration: TileEngineTiming.moveDurationSeconds,
				ease: TileEngineTiming.moveEase,
			},
		);
	}, [
		actorRef,
		enter,
		tileId,
	]);
};
