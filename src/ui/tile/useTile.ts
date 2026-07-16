import { type PointerEventHandler, useCallback, useContext, useEffect } from "react";

import type { TileIdentity } from "~/ui/tile/TileIdentity";
import { TileSystemContext } from "~/ui/tile/TileSystemContext";

export namespace useTile {
	export interface Props extends TileIdentity {}

	export interface Result {
		readonly ref: (node: HTMLElement | null) => void;
		readonly pressed: boolean;
		readonly pointerProps: {
			readonly onPointerDown: PointerEventHandler<HTMLElement>;
			readonly onPointerUp: PointerEventHandler<HTMLElement>;
			readonly onPointerCancel: PointerEventHandler<HTMLElement>;
			readonly onLostPointerCapture: PointerEventHandler<HTMLElement>;
		};
	}
}

/** Binds one rendered tile to shared transient interaction state without mirroring engine data. */
export const useTile = ({ id, revision }: useTile.Props): useTile.Result => {
	const system = useContext(TileSystemContext);
	if (system === null) throw new Error("TileSystemProvider is missing.");
	const { active, register, press, release: releasePointer, cancel: cancelPointer } = system;

	const ref = useCallback(
		(node: HTMLElement | null) =>
			register(
				{
					id,
					revision,
				},
				node,
			),
		[
			id,
			revision,
			register,
		],
	);

	useEffect(
		() => () =>
			cancelPointer({
				id,
				revision,
			}),
		[
			id,
			revision,
			cancelPointer,
		],
	);

	const onPointerDown = useCallback<PointerEventHandler<HTMLElement>>(
		(event) => {
			if (!event.isPrimary || event.button !== 0) return;
			event.currentTarget.setPointerCapture(event.pointerId);
			press({
				id,
				revision,
				pointerId: event.pointerId,
			});
		},
		[
			id,
			revision,
			press,
		],
	);

	const release = useCallback<PointerEventHandler<HTMLElement>>(
		(event) => {
			releasePointer({
				id,
				revision,
				pointerId: event.pointerId,
			});
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}
		},
		[
			id,
			revision,
			releasePointer,
		],
	);

	const cancel = useCallback<PointerEventHandler<HTMLElement>>(
		() =>
			cancelPointer({
				id,
				revision,
			}),
		[
			id,
			revision,
			cancelPointer,
		],
	);

	return {
		ref,
		pressed: active?.id === id && active.revision === revision,
		pointerProps: {
			onPointerDown,
			onPointerUp: release,
			onPointerCancel: cancel,
			onLostPointerCapture: cancel,
		},
	};
};
