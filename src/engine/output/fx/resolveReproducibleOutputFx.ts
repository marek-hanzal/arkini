import { Random } from "effect";

import type { OutputResolutionProps } from "~/engine/output/context/OutputResolutionFx";
import { readOutputResolutionSourceId } from "~/engine/output/OutputResolutionSource";
import { outputFx } from "~/engine/output/fx/outputFx";

const PlannerOutputRandomVersion = 1;

/** Resolves one stable canonical output branch independent of ambient randomness. */
export const resolveReproducibleOutputFx = ({ origin, output, source }: OutputResolutionProps) =>
	outputFx({
		origin,
		output,
	}).pipe(
		Random.withSeed(
			[
				"arkini:planner-output",
				PlannerOutputRandomVersion,
				source === undefined ? "anonymous" : readOutputResolutionSourceId(source),
				JSON.stringify(output),
			].join(":"),
		),
	);
