import { ItemArtwork } from "~/ui/ui/ItemArtwork";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

/** Shared visual identity for a production row; its owner supplies the exact work progress. */
export const ItemLineBackdrop = ({
	sourceUrl,
	progress,
}: {
	readonly sourceUrl: string;
	readonly progress?: number;
}) => (
	<div
		className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-[42%] -translate-x-1/2 opacity-[0.225] transition-[filter] duration-300 ease-out data-[ui-idle=true]:grayscale group-hover/production-row:data-[ui-idle=true]:grayscale-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_72%)]"
		{...readDataUiFn({
			dataUi: "ItemLineBackdrop",
			state: {
				idle: progress === undefined,
			},
		})}
	>
		<ItemArtwork
			className="size-full"
			imageClassName="object-cover"
			sourceUrl={sourceUrl}
			colorFraction={progress}
		/>
	</div>
);
