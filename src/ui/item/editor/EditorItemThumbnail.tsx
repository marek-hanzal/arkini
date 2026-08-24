import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { ItemArtwork } from "~/ui/item/ItemArtwork";
import { useEditorResourceUrl } from "~/ui/resource/editor/useEditorResourceUrl";
import { twMerge } from "tailwind-merge";

const thumbnailSizeClassName = {
	lg: "size-16",
	md: "size-12",
	sm: "size-11",
} as const;

export namespace EditorItemThumbnail {
	export interface Props {
		readonly className?: string;
		readonly imageClassName?: string;
		readonly resourceIds:
			| readonly [
					string,
			  ]
			| readonly [
					string,
					string,
			  ];
		readonly size?: keyof typeof thumbnailSizeClassName;
	}
}

/** Renders the compact item preview placed beside editor search controls. */
export const EditorItemSelectedThumbnail = ({
	resourceIds,
}: Pick<EditorItemThumbnail.Props, "resourceIds">) => (
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
	readonly item: EditorItem | undefined;
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
}: EditorItemThumbnail.Props) => {
	const backgroundUrl = useEditorResourceUrl(resourceIds[0]);
	const foregroundUrl = useEditorResourceUrl(resourceIds[1]);
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
