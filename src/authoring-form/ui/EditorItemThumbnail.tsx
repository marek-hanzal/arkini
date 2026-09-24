import { match, P } from "ts-pattern";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ItemArtwork } from "~/ui/ui/ItemArtwork";
import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";
import { twMerge } from "tailwind-merge";

const thumbnailSizeClassName = {
	input: "size-[var(--ak-control-min-height)]",
	lg: "size-24",
	md: "size-18",
	sm: "size-16.5",
	xl: "size-54",
} as const;

interface EditorItemThumbnailProps {
	readonly className?: string;
	readonly imageClassName?: string;
	readonly resourceUids: ItemSchema.Type["artwork"]["default"];
	readonly size?: keyof typeof thumbnailSizeClassName;
}

/** Renders the compact item preview placed beside editor search controls. */
const EditorItemSelectedThumbnail = ({
	className,
	resourceUids,
}: Pick<EditorItemThumbnailProps, "className" | "resourceUids">) => (
	<EditorItemThumbnail
		className={twMerge("rounded-lg", className)}
		resourceUids={resourceUids}
		size="input"
	/>
);

/** Resolves the appropriate item thumbnail used by shared search combobox slots. */
export const EditorItemSearchThumbnail = ({
	className,
	item,
	selected = false,
}: {
	readonly className?: string;
	readonly item: ItemSchema.Type | undefined;
	readonly selected?: boolean;
}) =>
	match({
		selected,
		item,
	})
		.with(
			{
				selected: true,
			},
			() => (
				<EditorItemSelectedThumbnail
					className={className}
					resourceUids={
						item?.artwork.default ?? [
							"",
						]
					}
				/>
			),
		)
		.with(
			{
				item: undefined,
			},
			() => null,
		)
		.with(
			{
				item: P.nonNullable,
			},
			({ item }) => (
				<EditorItemThumbnail
					className={className}
					resourceUids={item.artwork.default}
					size="lg"
				/>
			),
		)
		.exhaustive();

/** Renders the complete default item composition from back to front. */
export const EditorItemThumbnail = ({
	className,
	imageClassName,
	resourceUids,
	size = "lg",
}: EditorItemThumbnailProps) => {
	const backgroundUrl = useResourceUrl(resourceUids[0]);
	const foregroundUrl = useResourceUrl(resourceUids[1]);
	const ready =
		backgroundUrl !== undefined &&
		(resourceUids[1] === undefined || foregroundUrl !== undefined);
	if (ready) {
		return (
			<ItemArtwork
				className={twMerge(
					`${thumbnailSizeClassName[size]} overflow-hidden rounded-xl bg-canvas/70`,
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
				`relative grid ${thumbnailSizeClassName[size]} shrink-0 place-items-center overflow-hidden rounded-xl bg-canvas/70`,
				className,
			)}
			data-ui="EditorItemThumbnail"
		>
			{resourceUids[0] === "" ? null : (
				<span className="text-xl font-semibold text-subtle">?</span>
			)}
		</div>
	);
};
