import { ItemArtwork } from "~/ui/ui/ItemArtwork";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

/** Shared visual identity for a production row; its owner supplies the exact work progress. */
export const ItemLineBackdrop = ({
	sourceUrl,
	progress,
	materialsAvailable,
	ruleDisabled,
}: {
	readonly sourceUrl: string;
	readonly progress?: number;
	readonly materialsAvailable: boolean;
	readonly ruleDisabled: boolean;
}) => (
	<div
		className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-[42%] -translate-x-1/2 opacity-[0.27225] transition-[filter,opacity] duration-300 ease-out data-[ui-idle=true]:grayscale data-[ui-rule-disabled=true]:grayscale data-[ui-idle=true]:data-[ui-materials-available=true]:grayscale-[0.35] group-hover/production-row:data-[ui-idle=true]:data-[ui-rule-disabled=false]:grayscale-0 group-hover/production-row:data-[ui-rule-disabled=false]:opacity-[0.38] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_72%)]"
		{...readDataUiFn({
			dataUi: "ItemLineBackdrop",
			state: {
				idle: progress === undefined,
				materialsAvailable,
				ruleDisabled,
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
