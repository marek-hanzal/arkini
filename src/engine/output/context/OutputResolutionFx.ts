import { Context } from "effect";

import type { OutputResolutionSource } from "~/engine/output/OutputResolutionSource";
import { outputFx } from "~/engine/output/fx/outputFx";

export interface OutputResolutionProps extends outputFx.Props {
	readonly source?: OutputResolutionSource;
}

export interface OutputResolutionFxService {
	readonly resolve: (props: OutputResolutionProps) => ReturnType<typeof outputFx>;
}

/** Resolves authored output into one concrete engine-valid outcome. */
export const OutputResolutionFx = Context.Reference<OutputResolutionFxService>(
	"OutputResolutionFx",
	{
		defaultValue: () => ({
			resolve: ({ origin, output }) =>
				outputFx({
					origin,
					output,
				}),
		}),
	},
);

export type OutputResolutionFx = typeof OutputResolutionFx;
