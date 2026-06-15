import { memo, type ReactNode, type RefObject, useEffect, useRef } from "react";
import { registerTileEngineDrop } from "~/v0/tile-engine/dropRegistry";

export namespace TileEngineDropTarget {
	export interface Props<TDrop = unknown> {
		id: string;
		data: TDrop;
		disabled?: boolean;
		children(props: { ref: RefObject<HTMLDivElement | null> }): ReactNode;
	}
}

const TileEngineDropTargetComponent = <TDrop,>({
	id,
	data,
	disabled = false,
	children,
}: TileEngineDropTarget.Props<TDrop>) => {
	const ref = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (disabled || !ref.current) return;
		return registerTileEngineDrop({
			dropId: id,
			slot: null,
			targetTile: undefined,
			payload: data,
			element: ref.current,
		});
	}, [
		data,
		disabled,
		id,
	]);

	return children({
		ref,
	});
};

export const TileEngineDropTarget = memo(
	TileEngineDropTargetComponent,
) as typeof TileEngineDropTargetComponent;
