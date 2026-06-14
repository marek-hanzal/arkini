import type { Modifier } from "@dnd-kit/core";
import { useCallback, useMemo, type RefObject } from "react";
import type { RectLike } from "~/play/types";
import { clamp } from "~/shared/util/clamp";

export namespace useDragBoundaryModifier {
	export interface Props {
		boundaryRectRef: RefObject<RectLike | null>;
		enabled: boolean;
	}
}

export const useDragBoundaryModifier = ({
	boundaryRectRef,
	enabled,
}: useDragBoundaryModifier.Props) => {
	const restrictToDragBoundary = useCallback<Modifier>(
		({ transform, draggingNodeRect, activeNodeRect }) => {
			const draggingRect = draggingNodeRect ?? activeNodeRect;
			const boundaryRect = boundaryRectRef.current;

			if (!draggingRect || !boundaryRect) return transform;

			const minX = boundaryRect.left - draggingRect.left;
			const maxX =
				boundaryRect.left + boundaryRect.width - draggingRect.left - draggingRect.width;
			const minY = boundaryRect.top - draggingRect.top;
			const maxY =
				boundaryRect.top + boundaryRect.height - draggingRect.top - draggingRect.height;

			return {
				...transform,
				x: clamp(transform.x, minX, maxX),
				y: clamp(transform.y, minY, maxY),
			};
		},
		[
			boundaryRectRef,
		],
	);

	return useMemo(
		() =>
			enabled
				? [
						restrictToDragBoundary,
					]
				: [],
		[
			enabled,
			restrictToDragBoundary,
		],
	);
};
