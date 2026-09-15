import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";

const thumbnailSizeClassName = {
	input: "size-[var(--ak-control-min-height)]",
	lg: "size-24",
	md: "size-18",
	sm: "size-12",
	xl: "size-27",
} as const;

/** Renders one image-backed project Resource inside compact authoring selectors and fields. */
export const EditorResourceThumbnail = ({
	resourceId,
	size = "md",
}: {
	readonly resourceId: string | undefined;
	readonly size?: keyof typeof thumbnailSizeClassName;
}) => {
	const url = useResourceUrl(resourceId);
	return (
		<span
			data-ui="EditorResourceThumbnail"
			className={`grid ${thumbnailSizeClassName[size]} shrink-0 place-items-center overflow-hidden rounded-lg border border-control-border bg-canvas/70`}
		>
			{url === undefined ? (
				resourceId ? (
					<span className="text-sm font-semibold text-subtle">?</span>
				) : null
			) : (
				<img
					src={url}
					alt=""
					className="size-full object-contain"
					draggable={false}
				/>
			)}
		</span>
	);
};
