import type { RefObject } from "react";

import { EditorItemThumbnail } from "~/ui/item/EditorItemThumbnail";

/** Renders the pointer-following stack preview owned by a starting-grid drag session. */
export const EditorProjectStartGridDragPreview = ({
	clientX,
	clientY,
	quantity,
	resourceIds,
	previewRef,
}: {
	readonly clientX: number;
	readonly clientY: number;
	readonly previewRef: RefObject<HTMLDivElement | null>;
	readonly quantity: number;
	readonly resourceIds: EditorItemThumbnail.Props["resourceIds"];
}) => (
	<div
		className="pointer-events-none fixed top-0 left-0 z-[90] grid size-[4.5rem] place-items-center rounded-lg border border-accent bg-surface-raised/95 text-foreground shadow-2xl"
		data-ui="EditorProjectStartGridDragPreview"
		ref={previewRef}
		style={{
			transform: `translate3d(${clientX + 12}px, ${clientY + 12}px, 0)`,
		}}
	>
		<EditorItemThumbnail
			className="size-14 border-0 bg-transparent"
			resourceIds={resourceIds}
			size="sm"
		/>
		<span className="absolute right-1 bottom-1 rounded-md border border-line-strong bg-surface-raised/95 px-1.5 py-0.5 font-mono text-[0.65rem] font-bold text-foreground">
			×{quantity}
		</span>
	</div>
);
