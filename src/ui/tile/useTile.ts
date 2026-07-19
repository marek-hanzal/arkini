import { type PointerEventHandler, useCallback, useContext, useEffect, useRef } from "react";

import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropIntent } from "~/ui/tile/TileDropIntent";
import type { TileDropOutcome } from "~/ui/tile/TileDropOutcome";
import { TileSystemContext } from "~/ui/tile/TileSystemContext";

export namespace useTile {
	export interface Props {
		readonly source: TileDragSource;
		readonly onDrop: (intent: TileDropIntent) => Promise<TileDropOutcome> | TileDropOutcome;
	}

	export interface Result {
		readonly ref: (node: HTMLElement | null) => void;
		readonly pressed: boolean;
		readonly dragging: boolean;
		readonly pointerProps: {
			readonly onPointerDown: PointerEventHandler<HTMLElement>;
			readonly onPointerMove: PointerEventHandler<HTMLElement>;
			readonly onPointerUp: PointerEventHandler<HTMLElement>;
			readonly onPointerCancel: PointerEventHandler<HTMLElement>;
			readonly onLostPointerCapture: PointerEventHandler<HTMLElement>;
		};
	}
}

/** Binds one rendered tile to the shared unrestricted pointer controller. */
export const useTile = ({ source, onDrop }: useTile.Props): useTile.Result => {
	const system = useContext(TileSystemContext);
	if (system === null) throw new Error("TileSystemProvider is missing.");
	const { active, press, move, release, cancel } = system;
	const node = useRef<HTMLElement | null>(null);

	const ref = useCallback((nextNode: HTMLElement | null) => {
		node.current = nextNode;
	}, []);

	useEffect(
		() => () => cancel(source),
		[
			cancel,
			source,
		],
	);

	const onPointerDown = useCallback<PointerEventHandler<HTMLElement>>(
		(event) => {
			if (!event.isPrimary || event.button !== 0) return;
			event.preventDefault();
			const currentNode = node.current;
			if (currentNode === null) return;
			currentNode.setPointerCapture?.(event.pointerId);
			press({
				source,
				node: currentNode,
				pointerId: event.pointerId,
				x: event.clientX,
				y: event.clientY,
				onDrop,
			});
		},
		[
			onDrop,
			press,
			source,
		],
	);

	const onPointerMove = useCallback<PointerEventHandler<HTMLElement>>(
		(event) => {
			event.preventDefault();
			move({
				pointerId: event.pointerId,
				x: event.clientX,
				y: event.clientY,
			});
		},
		[
			move,
		],
	);

	const onPointerUp = useCallback<PointerEventHandler<HTMLElement>>(
		(event) => {
			event.preventDefault();
			release({
				pointerId: event.pointerId,
				x: event.clientX,
				y: event.clientY,
			});
			if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
				event.currentTarget.releasePointerCapture?.(event.pointerId);
			}
		},
		[
			release,
		],
	);

	const cancelPointer = useCallback<PointerEventHandler<HTMLElement>>(
		(event) => {
			const current = active;
			if (current?.source.id !== source.id || current.source.revision !== source.revision)
				return;
			if (current.phase === "settling") return;
			cancel(source);
			if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
				event.currentTarget.releasePointerCapture?.(event.pointerId);
			}
		},
		[
			active,
			cancel,
			source,
		],
	);

	const ownsActive =
		active?.source.id === source.id && active.source.revision === source.revision;

	return {
		ref,
		pressed: ownsActive && active.phase === "pressed",
		dragging: ownsActive && active.phase !== "pressed",
		pointerProps: {
			onPointerDown,
			onPointerMove,
			onPointerUp,
			onPointerCancel: cancelPointer,
			onLostPointerCapture: cancelPointer,
		},
	};
};
