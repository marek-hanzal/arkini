import type { Project } from "~/project-authoring/type/Project";
import type { AcquisitionRoute } from "~/flow/type/AcquisitionGraph";
import type { ItemOriginSource } from "~/flow/type/ItemOriginSource";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";
import type { RuleSchema } from "~/production-line/schema/RuleSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";

const itemFn = (project: Project, id: string) =>
	`${project.config.items[id]?.title ?? "missing"} [${id}]`;
const quantityFn = ({ min, max }: { readonly min: number; readonly max: number }) =>
	min === max ? String(min) : `${min}–${max}`;

const queryFn = (project: Project, query: QuerySchema.Type) =>
	`${itemFn(project, query.selector.itemId)} @${query.distance}`;
const whenFn = (project: Project, when: WhenSchema.Type): string => {
	switch (when.type) {
		case "exists":
			return `${queryFn(project, when.query)} exists`;
		case "count":
			return `${queryFn(project, when.query)} count=${when.count}`;
		case "range":
			return `${queryFn(project, when.query)} count=${when.min}–${when.max}`;
	}
};
// Preserve authored conjunctions and vetoes; acquisition requirements alone omit negative and spatial gates.
const rulesFn = (project: Project, rules: ReadonlyArray<RuleSchema.Type>) =>
	rules.length === 0
		? ""
		: ` rules: ${rules.map((rule) => `${rule.type}${rule.type === "runtime:adjust" ? ` ${rule.adjustMs} ms` : rule.type === "runtime:multiplier" ? ` x${rule.multiplier}` : ""}(${rule.when.map((when) => whenFn(project, when)).join(" AND ")})`).join("; ")}`;

const outcomeLinesFn = (project: Project, outcome: OutcomeTableSchema.Type | undefined): string[] =>
	(outcome?.set ?? []).flatMap((set, setIndex) => {
		const simpleSet =
			outcome?.set.length === 1 && set.rules.length === 0 && set.roll.length === 1;
		return [
			...(simpleSet
				? []
				: [
						`  Outcome set ${setIndex + 1}: weight ${set.weight}${rulesFn(project, set.rules)}`,
					]),
			...set.roll.flatMap((roll, rollIndex) =>
				roll.type === "chance" && roll.chance === 0
					? []
					: [
							`  ${simpleSet ? "Outcomes" : `Roll ${rollIndex + 1}`}: ${roll.type === "chance" ? `chance ${roll.chance * 100}%` : "guaranteed"} ${roll.outcome.map((drop) => (drop.type === "template" ? `Template ${project.config.templates?.find((template) => template.uid === drop.templateUid)?.title ?? drop.templateUid}${rulesFn(project, drop.rules)}` : drop.type === "space" ? `Space ${drop.space}${rulesFn(project, drop.rules)}` : `${itemFn(project, drop.itemId)} x${quantityFn(drop.quantity)}${drop.placement === "random" ? " random placement" : ""}${rulesFn(project, drop.rules)}`)).join("; ")}`,
						],
			),
		];
	});

const lineLinesFn = (
	project: Project,
	ownerId: string,
	line: LineSchema.Type,
	includeOwner = false,
): string[] => {
	const owner = project.config.items[ownerId];
	return [
		`  Line: ${includeOwner ? `${itemFn(project, ownerId)} / ${line.title} ` : ""}[${line.id}]; Runtime: ${line.runtimeMs / 1_000} s`,
		...(line.clock === true
			? [
					`  Clock weight: ${line.clockWeight}`,
				]
			: []),
		`  Inputs: ${line.input
			.map((input) => {
				const units =
					input.units === undefined
						? ""
						: `; units ${input.units.cost} from ${input.units.from}`;
				switch (input.type) {
					case "simple":
						return `simple${units}`;
					case "materials":
						return `${queryFn(project, input.query)} x${quantityFn(input.quantity)} ${input.mode}${units}`;
					case "units":
						return `${queryFn(project, input.query)} x1 units${units}`;
				}
			})
			.join("; ")}`,
		...(line.rules.length > 0 || !line.enable || !line.show
			? [
					`  Gates: enabled=${line.enable}; visible=${line.show}${rulesFn(project, line.rules)}`,
				]
			: []),
		...(owner?.clock?.durationMs !== undefined && (owner.ui !== "simple" || line.default)
			? [
					`  Owner lifetime: ${owner.clock.durationMs / 1000} s`,
				]
			: []),
		...(owner?.ui === "simple" && !line.default
			? [
					`  Automatic only: Clock enabled=${owner.clock?.enable ?? false}; interval=${owner.clock?.intervalMs ?? "none"} ms; lifetime=${owner.clock?.durationMs ?? "unbounded"} ms; Clock line=${line.clock === true}${rulesFn(project, owner.clock?.rules ?? [])}`,
				]
			: []),
	];
};

const mergeLinesFn = (
	project: Project,
	sourceId: string,
	mergeIndex: number,
	includeOwner = false,
): string[] => {
	const merge = project.config.items[sourceId]?.merge?.[mergeIndex];
	return merge === undefined
		? []
		: [
				`  Merge: ${includeOwner ? `${itemFn(project, sourceId)} / ` : ""}rule ${mergeIndex + 1}; Runtime: instant`,
				merge.action === "space"
					? `  Inputs: any dragged item transported to space ${merge.space}; receiver ${itemFn(project, sourceId)} x1 ${merge.effect}`
					: `  Inputs: source x1 ${merge.action}; target ${itemFn(project, merge.target.itemId)} x1 ${merge.effect}${sourceId === merge.target.itemId ? "; distinct source/target instances" : ""}`,
			];
};

/** Compact authored presentation of one already-discovered operation; never performs traversal or estimation. */
export const readRelationOperationSummaryFn = (
	project: Project,
	source: ItemOriginSource,
	routes: ReadonlyArray<AcquisitionRoute>,
): ReadonlyArray<string> => {
	const owner = project.config.items[source.ownerItemId];
	const reference = source.reference;
	switch (reference.type) {
		case "line": {
			const line = owner?.lines.find(({ id }) => id === reference.lineId);
			return line === undefined
				? []
				: [
						...lineLinesFn(project, source.ownerItemId, line),
						...outcomeLinesFn(project, line.outcome),
					];
		}
		case "merge": {
			const merge = owner?.merge?.[reference.ruleNumber - 1];
			return [
				...mergeLinesFn(project, source.ownerItemId, reference.ruleNumber - 1),
				...(merge?.effect === "replace"
					? [
							`  Replacement outcome: ${itemFn(project, merge.result)} x1`,
						]
					: []),
				...outcomeLinesFn(project, merge?.outcome),
			];
		}
		case "expiry":
			return [
				`  Inputs: ${itemFn(project, source.ownerItemId)} x1 expires; Runtime: ${(source.runtimeMs ?? 0) / 1_000} s`,
				`  Clock gates: enabled=${owner?.clock?.enable}${rulesFn(project, owner?.clock?.rules ?? [])}`,
				...outcomeLinesFn(project, owner?.clock?.onExpire),
			];
		case "units": {
			// The canonical source groups all depletion triggers. Show each distinct trigger once, not once per emitted drop.
			const triggers = new Map<string, AcquisitionRoute>();
			for (const route of routes) triggers.set(JSON.stringify(route.metadata), route);
			return [
				`  Depletion: ${itemFn(project, source.ownerItemId)}; capacity ${owner?.units?.amount} units`,
				...Array.from(triggers.values()).flatMap((route) => {
					const metadata = route.metadata;
					const header = `  Trigger (${route.runMultiplier} actions per depletion):`;
					if (metadata.kind === "line-unit-depletion") {
						const line = project.config.items[metadata.ownerItemId]?.lines.find(
							({ id }) => id === metadata.lineId,
						);
						return line === undefined
							? []
							: [
									header,
									...lineLinesFn(project, metadata.ownerItemId, line, true),
								];
					}
					if (metadata.kind !== "merge-unit-depletion") return [];
					const merge =
						project.config.items[metadata.sourceItemId]?.merge?.[metadata.mergeIndex];
					const participants = [
						...(merge?.action === "spend" &&
						metadata.sourceItemId === source.ownerItemId
							? [
									"source",
								]
							: []),
						...(merge?.effect === "spend" &&
						metadata.targetItemId === source.ownerItemId
							? [
									"target",
								]
							: []),
					];
					return [
						header,
						`  Depletion participants: ${participants.join(" and ")}${participants.length === 2 ? " (distinct instances)" : ""}`,
						...mergeLinesFn(project, metadata.sourceItemId, metadata.mergeIndex, true),
					];
				}),
				"  Outcomes per depleted instance; each participant rolls separately:",
				...outcomeLinesFn(project, owner?.units?.outcome),
			];
		}
	}
};
