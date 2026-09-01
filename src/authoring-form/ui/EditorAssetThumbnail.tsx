import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";

const thumbnailSizeClassName = {
	lg: "size-16",
	md: "size-12",
	sm: "size-8",
} as const;

/** Renders one project asset inside compact authoring selectors and fields. */
export const EditorAssetThumbnail = ({
	resourceId,
	size = "md",
}: {
	readonly resourceId: string | undefined;
	readonly size?: keyof typeof thumbnailSizeClassName;
}) => {
	const url = useResourceUrl(resourceId);
	return (
		<span
			className={`grid ${thumbnailSizeClassName[size]} shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-canvas/70`}
		>
			{url === undefined ? (
				<span className="text-sm font-semibold text-subtle">?</span>
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
