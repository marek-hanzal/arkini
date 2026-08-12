import { Context } from "effect";

import { outputFx } from "~/engine/output/fx/outputFx";

export interface OutputResolutionFxService {
	readonly resolve: (props: outputFx.Props) => ReturnType<typeof outputFx>;
}

/** Resolves authored output into one concrete engine-valid outcome. */
export const OutputResolutionFx = Context.Reference<OutputResolutionFxService>(
	"OutputResolutionFx",
	{
		defaultValue: () => ({
			resolve: outputFx,
		}),
	},
);

export type OutputResolutionFx = typeof OutputResolutionFx;
