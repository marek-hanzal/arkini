import { ItemArtwork } from "~/ui/ui/ItemArtwork";

/** Shared visual identity for a production row; its owner supplies the exact work progress. */
export const ItemLineBackdrop = ({
	sourceUrl,
	progress = 0,
}: {
	readonly sourceUrl: string;
	readonly progress?: number;
}) => (
	<div
		className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-[42%] -translate-x-1/2 opacity-45 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_72%)]"
		data-ui="ItemLineBackdrop"
	>
		<ItemArtwork
			className="size-full"
			imageClassName="object-cover"
			sourceUrl={sourceUrl}
			colorFraction={progress}
		/>
	</div>
);
