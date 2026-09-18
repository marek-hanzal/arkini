import { motion } from "motion/react";
import { twMerge } from "tailwind-merge";

const artworkSizeClassName = {
	input: "size-[var(--ak-control-min-height)]",
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
	/** Fraction of the artwork revealed in color from the bottom, with a feathered boundary. */
	readonly colorFraction?: number;
}

/** Renders the canonical single or top-left-to-bottom-right composite item artwork. */
export const ItemArtwork = ({
	className = "",
	compositeUrl,
	dataUi,
	imageClassName = "",
	size = "sm",
	sourceUrl,
	colorFraction,
}: ItemArtworkProps) => {
	const layered = compositeUrl !== undefined;
	const depleted = 1 - Math.max(0, Math.min(1, colorFraction ?? 1));
	const boundary = depleted === 0 ? -8 : depleted === 1 ? 108 : depleted * 100;
	const sharedImageClassName =
		"absolute object-contain drop-shadow-[0_0.3rem_0.5rem_color-mix(in_srgb,var(--ak-overlay)_28%,transparent)]";
	return (
		<span
			className={twMerge(
				`relative isolate block shrink-0 ${artworkSizeClassName[size]}`,
				className,
			)}
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
			{colorFraction !== undefined ? (
				<motion.span
					className="pointer-events-none absolute inset-0 z-20 backdrop-grayscale"
					initial={false}
					animate={{
						// Keep the composed filter mounted at both endpoints so the feather can move continuously.
						maskImage: `linear-gradient(to bottom, black ${boundary - 8}%, transparent ${boundary + 8}%)`,
					}}
					transition={{
						duration: 0.3,
						ease: "easeOut",
					}}
				/>
			) : null}
		</span>
	);
};
