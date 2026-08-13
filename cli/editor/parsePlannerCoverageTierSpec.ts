import {
	PlannerCoverageTierAuditInputError,
	type PlannerCoverageTierDefinition,
} from "~/editor/planner/PlannerCoverageTierAudit";

export const DefaultPlannerCoverageTierSpec =
	"smoke=25:1:1:500,narrow=100:4:4:500,medium=250:8:8:500,editor=1000:16:16:500";

const readPositiveInteger = ({
	field,
	tierId,
	value,
}: {
	readonly field: string;
	readonly tierId: string;
	readonly value: string | undefined;
}) => {
	const parsed = value === undefined ? Number.NaN : Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0)
		throw new PlannerCoverageTierAuditInputError({
			message: `Planner coverage tier ${tierId} has invalid ${field}: ${value ?? "missing"}.`,
		});
	return parsed;
};

/** Parses `id=expanded:queued:routePlans:traceLength` comma-separated tier definitions. */
export const parsePlannerCoverageTierSpec = (
	specification: string,
): ReadonlyArray<PlannerCoverageTierDefinition> => {
	const entries = specification
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
	if (entries.length === 0)
		throw new PlannerCoverageTierAuditInputError({
			message: "Planner coverage tier specification is empty.",
		});
	return entries.map((entry, index) => {
		const separatorIndex = entry.indexOf("=");
		if (separatorIndex <= 0 || separatorIndex === entry.length - 1)
			throw new PlannerCoverageTierAuditInputError({
				message: `Planner coverage tier ${index + 1} must use id=expanded:queued:routePlans:traceLength syntax.`,
			});
		const id = entry.slice(0, separatorIndex).trim();
		const values = entry
			.slice(separatorIndex + 1)
			.split(":")
			.map((value) => value.trim());
		if (values.length !== 4)
			throw new PlannerCoverageTierAuditInputError({
				message: `Planner coverage tier ${id} must define exactly four budget limits.`,
			});
		return {
			budget: {
				maximumExpandedStates: readPositiveInteger({
					field: "maximumExpandedStates",
					tierId: id,
					value: values[0],
				}),
				maximumQueuedStates: readPositiveInteger({
					field: "maximumQueuedStates",
					tierId: id,
					value: values[1],
				}),
				maximumRoutePlans: readPositiveInteger({
					field: "maximumRoutePlans",
					tierId: id,
					value: values[2],
				}),
				maximumTraceLength: readPositiveInteger({
					field: "maximumTraceLength",
					tierId: id,
					value: values[3],
				}),
			},
			id,
		} satisfies PlannerCoverageTierDefinition;
	});
};
