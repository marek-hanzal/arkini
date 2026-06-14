import type { DragStartEvent } from "@dnd-kit/core";
import { useRef, useState, type RefObject } from "react";
import type { DraggablePayload } from "~/drag/DraggablePayload";
import { rectForBoundaryNode } from "~/drag/logic/rectForBoundaryNode";
import type { RectLike } from "~/play/types";

export namespace useDragSession {
	export interface Props<ItemId extends string, Source, Overlay> {
		getDragBoundaryNodeId?(
			source: DraggablePayload<ItemId, Source, Overlay>,
		): string | null | undefined;
	}

	export interface Result<ItemId extends string, Source, Overlay> {
		activeDragRef: RefObject<DraggablePayload<ItemId, Source, Overlay> | null>;
		dragBoundaryRectRef: RefObject<RectLike | null>;
		activeDrag: DraggablePayload<ItemId, Source, Overlay> | null;
		dragPreviewRect: Pick<RectLike, "width" | "height"> | null;
		start(event: DragStartEvent): DraggablePayload<ItemId, Source, Overlay> | null;
		clear(): void;
		clearPreview(): void;
	}
}

export const useDragSession = <
	ItemId extends string = string,
	Source = unknown,
	Overlay = unknown,
>({
	getDragBoundaryNodeId,
}: useDragSession.Props<ItemId, Source, Overlay>): useDragSession.Result<
	ItemId,
	Source,
	Overlay
> => {
	const activeDragRef = useRef<DraggablePayload<ItemId, Source, Overlay> | null>(null);
	const dragBoundaryRectRef = useRef<RectLike | null>(null);
	const [activeDrag, setActiveDrag] = useState<DraggablePayload<ItemId, Source, Overlay> | null>(
		null,
	);
	const [dragPreviewRect, setDragPreviewRect] = useState<Pick<
		RectLike,
		"width" | "height"
	> | null>(null);

	const clear = () => {
		activeDragRef.current = null;
		dragBoundaryRectRef.current = null;
		setActiveDrag(null);
		setDragPreviewRect(null);
	};

	const start = (event: DragStartEvent) => {
		const source = event.active.data.current as DraggablePayload<
			ItemId,
			Source,
			Overlay
		> | null;
		activeDragRef.current = source;
		dragBoundaryRectRef.current = source
			? rectForBoundaryNode({
					nodeId: getDragBoundaryNodeId?.(source),
				})
			: null;
		setActiveDrag(source);
		const rect = (event.active.rect.current.initial ??
			event.active.rect.current.translated) as RectLike | null;
		setDragPreviewRect(
			rect
				? {
						width: rect.width,
						height: rect.height,
					}
				: null,
		);
		return source;
	};

	return {
		activeDragRef,
		dragBoundaryRectRef,
		activeDrag,
		dragPreviewRect,
		start,
		clear,
		clearPreview: () => setDragPreviewRect(null),
	};
};
