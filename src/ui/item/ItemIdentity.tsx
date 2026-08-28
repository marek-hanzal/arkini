import type { ReactNode } from "react";

import { ItemArtwork, type ItemArtworkProps } from "~/ui/item/ItemArtwork";

export interface ItemIdentityProps {
	readonly artworkClassName?: string;
	readonly artworkDataUi?: string;
	readonly artworkImageClassName?: string;
	readonly className?: string;
	readonly compositeUrl?: string;
	readonly dataUi?: string;
	readonly description?: ReactNode;
	readonly rootTag?: "div" | "span";
	readonly size?: ItemArtworkProps["size"];
	readonly sourceUrl: string;
	readonly title: string;
	readonly titleClassName?: string;
	readonly titleId?: string;
	readonly titleTag?: "h2" | "h3" | "span";
}

/** Renders one canonical artwork stack next to an item's title and optional context. */
export const ItemIdentity = ({
	artworkClassName = "",
	artworkDataUi,
	artworkImageClassName = "",
	className = "",
	compositeUrl,
	dataUi,
	description,
	rootTag: Root = "div",
	size = "sm",
	sourceUrl,
	title,
	titleClassName = "truncate font-medium text-foreground",
	titleId,
	titleTag: Title = "span",
}: ItemIdentityProps) => {
	const Text = Root === "span" ? "span" : "div";
	return (
		<Root
			className={`flex min-w-0 items-center gap-3 ${className}`}
			data-ui={dataUi}
		>
			<ItemArtwork
				className={artworkClassName}
				compositeUrl={compositeUrl}
				dataUi={artworkDataUi}
				imageClassName={artworkImageClassName}
				size={size}
				sourceUrl={sourceUrl}
			/>
			<Text className="min-w-0">
				<Title
					id={titleId}
					className={titleClassName}
				>
					{title}
				</Title>
				{description}
			</Text>
		</Root>
	);
};
