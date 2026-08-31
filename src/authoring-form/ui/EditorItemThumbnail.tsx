import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ItemArtwork } from "~/ui/ui/ItemArtwork";
import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";
import { twMerge } from "tailwind-merge";

const thumbnailSizeClassName = {
	lg: "size-16",
	md: "size-12",
	sm: "size-11",
} as const;

interface EditorItemThumbnailProps {
	readonly className?: string;
	readonly imageClassName?: string;
	readonly resourceIds: ItemSchema.Type["asset"]["default"];
	readonly size?: keyof typeof thumbnailSizeClassName;
}

/** Renders the compact item preview placed beside editor search controls. */
const EditorItemSelectedThumbnail = ({
	resourceIds,
}: Pick<EditorItemThumbnailProps, "resourceIds">) => (
	<EditorItemThumbnail
		className="size-10 rounded-lg border-line-strong"
		resourceIds={resourceIds}
		size="sm"
	/>
);

/** Resolves the appropriate item thumbnail used by shared search combobox slots. */
export const EditorItemSearchThumbnail = ({
	item,
	selected = false,
}: {
	readonly item: ItemSchema.Type | undefined;
	readonly selected?: boolean;
}) =>
	item === undefined ? null : selected ? (
		<EditorItemSelectedThumbnail resourceIds={item.asset.default} />
	) : (
		<EditorItemThumbnail
			resourceIds={item.asset.default}
			size="sm"
		/>
	);

/** Renders the complete default item composition from back to front. */
export const EditorItemThumbnail = ({
	className,
	imageClassName,
	resourceIds,
	size = "lg",
}: EditorItemThumbnailProps) => {
	const backgroundUrl = useResourceUrl(resourceIds[0]);
	const foregroundUrl = useResourceUrl(resourceIds[1]);
	const ready =
		backgroundUrl !== undefined &&
		(resourceIds[1] === undefined || foregroundUrl !== undefined);
	if (ready) {
		return (
			<ItemArtwork
				className={twMerge(
					"overflow-hidden rounded-xl border border-line bg-canvas/70",
					className,
				)}
				compositeUrl={foregroundUrl}
				dataUi="EditorItemThumbnail"
				imageClassName={imageClassName}
				size={size}
				sourceUrl={backgroundUrl}
			/>
		);
	}
	return (
		<div
			className={twMerge(
				`relative grid ${thumbnailSizeClassName[size]} shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-canvas/70`,
				className,
			)}
			data-ui="EditorItemThumbnail"
		>
			<span className="text-xl font-semibold text-subtle">?</span>
		</div>
	);
};
