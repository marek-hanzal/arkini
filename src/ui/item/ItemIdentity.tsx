import type { ReactNode } from "react";

const artworkSizeClassName = {
	lg: "size-16",
	md: "size-12",
	sm: "size-11",
} as const;

export interface ItemIdentityProps {
	readonly artworkClassName?: string;
	readonly artworkDataUi?: string;
	readonly artworkImageClassName?: string;
	readonly className?: string;
	readonly compositeUrl?: string;
	readonly dataUi?: string;
	readonly description?: ReactNode;
	readonly rootTag?: "div" | "span";
	readonly size?: keyof typeof artworkSizeClassName;
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
			<span
				className={`relative block shrink-0 ${artworkSizeClassName[size]} ${artworkClassName}`}
				data-ui={artworkDataUi}
			>
				<img
					className={`absolute inset-0 size-full object-contain drop-shadow-[0_0.3rem_0.5rem_color-mix(in_srgb,var(--ak-overlay)_28%,transparent)] ${artworkImageClassName}`}
					src={sourceUrl}
					alt=""
					draggable={false}
				/>
				{compositeUrl === undefined ? null : (
					<img
						className={`absolute inset-0 size-full object-contain drop-shadow-[0_0.3rem_0.5rem_color-mix(in_srgb,var(--ak-overlay)_28%,transparent)] ${artworkImageClassName}`}
						src={compositeUrl}
						alt=""
						draggable={false}
					/>
				)}
			</span>
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
