const artworkSizeClassName = {
	lg: "size-16",
	md: "size-12",
	sm: "size-11",
	xl: "size-36",
} as const;

export interface ItemArtworkProps {
	readonly className?: string;
	readonly compositeUrl?: string;
	readonly dataUi?: string;
	readonly imageClassName?: string;
	readonly size?: keyof typeof artworkSizeClassName;
	readonly sourceUrl: string;
}

/** Renders the canonical single or top-left-to-bottom-right composite item artwork. */
export const ItemArtwork = ({
	className = "",
	compositeUrl,
	dataUi,
	imageClassName = "",
	size = "sm",
	sourceUrl,
}: ItemArtworkProps) => {
	const layered = compositeUrl !== undefined;
	const sharedImageClassName =
		"absolute object-contain drop-shadow-[0_0.3rem_0.5rem_color-mix(in_srgb,var(--ak-overlay)_28%,transparent)]";
	return (
		<span
			className={`relative block shrink-0 ${artworkSizeClassName[size]} ${className}`}
			data-ui={dataUi}
		>
			<img
				className={`${sharedImageClassName} ${
					layered ? "top-0 left-0 size-3/4" : "inset-0 size-full"
				} ${imageClassName}`}
				src={sourceUrl}
				alt=""
				draggable={false}
			/>
			{compositeUrl === undefined ? null : (
				<img
					className={`${sharedImageClassName} right-0 bottom-0 z-10 size-3/4 ${imageClassName}`}
					src={compositeUrl}
					alt=""
					draggable={false}
				/>
			)}
		</span>
	);
};
