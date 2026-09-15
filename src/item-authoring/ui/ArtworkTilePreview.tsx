import { twMerge } from "tailwind-merge";

import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import type { ArtworkSchema } from "~/item-definition/schema/ArtworkSchema";

/** Compares the authored artwork canvas with its unchanged full tile bounds. */
export const ArtworkTilePreview = ({
	className,
	resourceIds,
	scale,
}: {
	readonly className?: string;
	readonly resourceIds: ArtworkSchema.Type["default"];
	readonly scale: number;
}) => (
	<div
		className={twMerge(
			"grid size-54 shrink-0 place-items-center overflow-hidden rounded-xl border border-control-border bg-canvas/70",
			className,
		)}
		data-ui="EditorArtworkTilePreview"
	>
		<div
			style={{
				width: `${scale * 100}%`,
				height: `${scale * 100}%`,
			}}
		>
			<EditorItemThumbnail
				className="size-full rounded-none border-0 bg-transparent"
				resourceIds={resourceIds}
			/>
		</div>
	</div>
);
