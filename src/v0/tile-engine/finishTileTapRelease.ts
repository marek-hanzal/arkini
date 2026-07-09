import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { resetElementTransform } from "~/tile-engine/resetElementTransform";
import type { TileEngineActor } from "~/tile-engine/TileEngineActor.types";

export namespace finishTileTapRelease {
	export interface Props<TDrag = unknown> {
		event: Pick<ReactPointerEvent<HTMLDivElement>, "clientX" | "clientY" | "pointerId">;
		session: TileEngineActor.DragSession<TDrag>;
		element: HTMLElement | null;
		dragSessionRef: RefObject<TileEngineActor.DragSession<TDrag> | null>;
		handleTap(event: Pick<ReactPointerEvent<HTMLDivElement>, "clientX" | "clientY">): void;
	}
}

export const finishTileTapRelease = <TDrag>({
	event,
	session,
	element,
	dragSessionRef,
	handleTap,
}: finishTileTapRelease.Props<TDrag>) => {
	const longFired = session.longFired;
	dragSessionRef.current = null;
	resetElementTransform(element);
	if (!longFired) handleTap(event);
};
