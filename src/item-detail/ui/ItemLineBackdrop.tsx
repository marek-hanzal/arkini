import { Play } from "lucide-react";
import { ItemArtwork } from "~/ui/ui/ItemArtwork";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

/** Shared visual identity for a production row; its owner supplies the exact work progress. */
export const ItemLineBackdrop = ({
	sourceUrl,
	progress,
	colorAvailable,
	ruleDisabled,
	playCue,
}: {
	readonly sourceUrl: string;
	readonly progress?: number;
	readonly colorAvailable: boolean;
	readonly ruleDisabled: boolean;
	readonly playCue: boolean;
}) => (
	<div
		className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-[42%] -translate-x-1/2 opacity-[0.27225] transition-[filter,opacity] duration-300 ease-out data-[ui-idle=true]:grayscale data-[ui-rule-disabled=true]:grayscale data-[ui-idle=true]:data-[ui-color-available=true]:grayscale-[0.35] group-hover/production-row:data-[ui-idle=true]:data-[ui-color-available=true]:grayscale-0 group-hover/production-row:opacity-[0.38] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_72%)]"
		{...readDataUiFn({
			dataUi: "ItemLineBackdrop",
			state: {
				idle: progress === undefined,
				colorAvailable,
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
		<Play
			className="absolute top-1/2 left-1/2 size-16 -translate-x-1/2 -translate-y-1/2 fill-current text-muted opacity-0 grayscale transition-opacity duration-300 data-[ui-visible=true]:opacity-75"
			{...readDataUiFn({
				dataUi: "ItemLinePlayCue",
				state: {
					visible: playCue && progress === undefined,
				},
			})}
		/>
	</div>
);
