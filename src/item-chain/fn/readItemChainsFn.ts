import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { DropSchema } from "~/production-output/schema/DropSchema";

export namespace readItemChainsFn {
	export type Stop = "final" | "retained" | "spent" | "cycle" | "depth" | "missing" | "ongoing";
	export interface OutputPath {
		readonly set: number;
		readonly setWeight: number;
		readonly alternative: boolean;
		readonly roll: number;
		readonly type: "guaranteed" | "chance" | "weight";
		readonly chance?: number;
		readonly candidate?: number;
		readonly weight?: number;
		readonly selections?: {
			readonly min: number;
			readonly max: number;
		};
		readonly conditional: boolean;
	}
	export interface Node {
		readonly path: string;
		readonly itemId: string;
		readonly quantity?: {
			readonly min: number;
			readonly max: number;
		};
		readonly output?: OutputPath;
		readonly stop?: Stop;
		readonly steps: readonly Step[];
	}
	export interface Step {
		readonly path: string;
		readonly kind: "merge" | "expiry" | "pulse";
		readonly ownerId: string;
		readonly targetId?: string;
		readonly mergeIndex?: number;
		readonly lineId?: string;
		readonly lineTitle?: string;
		readonly timeMs?: number;
		readonly lifetimeMs?: number;
		readonly runtimeMs?: number;
		readonly sourceAction?: string;
		readonly targetEffect?: string;
		readonly conditional: boolean;
		readonly disabled: boolean;
		readonly inputCount: number;
		readonly incomplete: boolean;
		readonly branches: readonly Node[];
	}
	export interface Outcome {
		readonly itemId?: string;
		readonly stop: Stop | "no-output";
		readonly periodic: boolean;
		readonly conditional: boolean;
	}
	export interface Chain {
		readonly id: string;
		readonly kind: "merge" | "clock";
		readonly ownerId: string;
		readonly targetId?: string;
		readonly steps: readonly Step[];
		readonly outcomes: readonly Outcome[];
	}
	export interface Result {
		readonly chains: readonly Chain[];
		readonly truncated: boolean;
	}
}

/** Authored possibilities, not a simulation: only root merges initiate interaction.
 * Clock continuations retain output grouping and per-operation quantities, never
 * multiply periodic yields or pretend that runtime admission/conditions succeeded.
 */
export const readItemChainsFn = (
	items: Readonly<Record<string, ItemSchema.Type>>,
	rootId: string,
	maxDepth = 5,
): readItemChainsFn.Result => {
	const root = items[rootId];
	if (root === undefined)
		return {
			chains: [],
			truncated: false,
		};
	const depthLimit = Number.isFinite(maxDepth)
		? Math.max(1, Math.min(12, Math.floor(maxDepth)))
		: 5;
	let remaining = 400;
	let truncated = false;
	let omitted = 0;

	const nodeFn = (
		itemId: string,
		path: string,
		depth: number,
		ancestors: readonly string[],
		quantity?: readItemChainsFn.Node["quantity"],
		output?: readItemChainsFn.OutputPath,
		preserved?: "retained" | "spent",
	): readItemChainsFn.Node => {
		const item = items[itemId];
		const stop: readItemChainsFn.Stop | undefined =
			item === undefined
				? "missing"
				: preserved !== undefined
					? preserved
					: item.clock === undefined
						? "final"
						: ancestors.includes(itemId)
							? "cycle"
							: depth >= depthLimit
								? "depth"
								: undefined;
		return {
			itemId,
			path,
			quantity,
			output,
			stop: stop ?? (item?.clock?.durationMs === undefined ? "ongoing" : undefined),
			steps:
				stop === undefined && item !== undefined
					? clockFn(item, path, depth, [
							...ancestors,
							itemId,
						])
					: [],
		};
	};
	const outputFn = (
		output: OutputSchema.Type | undefined,
		path: string,
		depth: number,
		ancestors: readonly string[],
	): readItemChainsFn.Node[] => {
		const nodes: readItemChainsFn.Node[] = [];
		const appendFn = (
			drop: DropSchema.Type,
			suffix: string,
			meta: readItemChainsFn.OutputPath,
		) => {
			if (drop.quantity.max === 0) return;
			if (remaining <= 0) {
				truncated = true;
				omitted++;
				return;
			}
			remaining--;
			nodes.push(
				nodeFn(drop.itemId, `${path}/${suffix}`, depth, ancestors, drop.quantity, {
					...meta,
					conditional: drop.rules.length > 0,
				}),
			);
		};
		for (const [setIndex, set] of (output?.set ?? []).entries()) {
			for (const [rollIndex, roll] of set.roll.entries()) {
				if (roll.type === "chance" && roll.chance === 0) continue;
				const meta: readItemChainsFn.OutputPath = {
					set: setIndex,
					setWeight: set.weight,
					alternative: (output?.set.length ?? 0) > 1,
					roll: rollIndex,
					type: roll.type,
					conditional: false,
					chance: roll.type === "chance" ? roll.chance : undefined,
				};
				if (roll.type === "weight") {
					if (roll.quantity.max === 0) continue;
					for (const [candidateIndex, candidate] of roll.drop.entries())
						for (const [dropIndex, drop] of candidate.drop.entries())
							appendFn(
								drop,
								`${setIndex}/${rollIndex}/${candidateIndex}/${dropIndex}`,
								{
									...meta,
									candidate: candidateIndex,
									weight: candidate.weight,
									selections: roll.quantity,
								},
							);
				} else {
					for (const [dropIndex, drop] of roll.drop.entries())
						appendFn(drop, `${setIndex}/${rollIndex}/${dropIndex}`, meta);
				}
			}
		}
		return nodes;
	};
	const clockFn = (
		item: ItemSchema.Type,
		path: string,
		depth: number,
		ancestors: readonly string[],
	): readItemChainsFn.Step[] => {
		const clock = item.clock;
		if (clock === undefined) return [];
		const steps: readItemChainsFn.Step[] = [];
		const line = item.lines.find((candidate) => candidate.clock);
		if (
			clock.intervalMs !== undefined &&
			line !== undefined &&
			(clock.durationMs === undefined || clock.intervalMs <= clock.durationMs)
		) {
			const nextPath = `${path}/pulse`;
			const before = omitted;
			const branches = outputFn(line.output, nextPath, depth + 1, ancestors);
			steps.push({
				path: nextPath,
				kind: "pulse",
				ownerId: item.id,
				lineId: line.id,
				lineTitle: line.title,
				timeMs: clock.intervalMs,
				lifetimeMs: clock.durationMs,
				runtimeMs: line.runtimeMs,
				conditional:
					clock.rules.length > 0 ||
					line.rules.length > 0 ||
					line.input.some(
						(input) => input.type !== "simple" || input.units !== undefined,
					),
				disabled: !clock.enable || !line.enable,
				inputCount: line.input.filter(
					(input) => input.type !== "simple" || input.units !== undefined,
				).length,
				branches,
				incomplete: omitted > before,
			});
		}
		if (clock.durationMs !== undefined) {
			const nextPath = `${path}/expiry`;
			const before = omitted;
			const branches = outputFn(clock.onExpire, nextPath, depth + 1, ancestors);
			steps.push({
				path: nextPath,
				kind: "expiry",
				ownerId: item.id,
				timeMs: clock.durationMs,
				conditional: clock.rules.length > 0,
				disabled: !clock.enable,
				inputCount: 0,
				branches,
				incomplete: omitted > before,
			});
		}
		return steps;
	};
	const outcomesFn = (steps: readonly readItemChainsFn.Step[]): readItemChainsFn.Outcome[] => {
		const outcomes: readItemChainsFn.Outcome[] = [];
		const visitFn = (
			steps: readonly readItemChainsFn.Step[],
			periodic: boolean,
			conditional: boolean,
		): void => {
			for (const step of steps) {
				const repeated = periodic || step.kind === "pulse";
				const contingent = conditional || step.conditional || step.disabled;
				if (step.branches.length === 0 && !step.incomplete)
					outcomes.push({
						stop: "no-output",
						periodic: repeated,
						conditional: contingent,
					});
				for (const node of step.branches) {
					const possible =
						contingent ||
						node.output?.conditional === true ||
						node.output?.alternative === true ||
						(node.output !== undefined && node.output.type !== "guaranteed");
					if (node.stop !== undefined)
						outcomes.push({
							itemId: node.itemId,
							stop: node.stop,
							periodic: repeated,
							conditional: possible,
						});
					visitFn(node.steps, repeated, possible);
				}
			}
		};
		visitFn(steps, false, false);
		return outcomes.filter(
			(outcome, index) =>
				outcomes.findIndex(
					(other) =>
						other.itemId === outcome.itemId &&
						other.stop === outcome.stop &&
						other.periodic === outcome.periodic &&
						other.conditional === outcome.conditional,
				) === index,
		);
	};
	const chains: Array<Omit<readItemChainsFn.Chain, "outcomes">> = [];
	const seenTargets = new Set<string>();
	for (const [mergeIndex, merge] of (root.merge ?? []).entries()) {
		if (remaining <= 0) {
			truncated = true;
			break;
		}
		remaining--;
		// Canonical merge admission uses the first exact target rule, never reverse matching.
		if (seenTargets.has(merge.target.itemId)) continue;
		seenTargets.add(merge.target.itemId);
		const path = `merge/${mergeIndex}`;
		const before = omitted;
		const branches: readItemChainsFn.Node[] = [];
		if (merge.effect === "replace")
			branches.push(nodeFn(merge.result, `${path}/replacement`, 1, []));
		else if (merge.effect === "keep" || merge.effect === "spend")
			branches.push(
				nodeFn(
					merge.target.itemId,
					`${path}/target`,
					1,
					[],
					undefined,
					undefined,
					merge.effect === "keep" ? "retained" : "spent",
				),
			);
		if (merge.action !== "consume")
			branches.push(
				nodeFn(
					root.id,
					`${path}/source`,
					1,
					[],
					undefined,
					undefined,
					merge.action === "use" ? "retained" : "spent",
				),
			);
		branches.push(...outputFn(merge.output, `${path}/output`, 1, []));
		// Spending may exhaust either participant. These are conditional merge side
		// effects; existing identities are not restarted with a fresh Clock.
		for (const [role, participant] of [
			[
				"source",
				merge.action === "spend" ? root : undefined,
			],
			[
				"target",
				merge.effect === "spend" ? items[merge.target.itemId] : undefined,
			],
		] as const) {
			if (participant?.units?.output === undefined) continue;
			branches.push(
				...outputFn(participant.units.output, `${path}/${role}-depletion`, 1, []).map(
					(node) => ({
						...node,
						output:
							node.output === undefined
								? undefined
								: {
										...node.output,
										conditional: true,
									},
					}),
				),
			);
		}
		const steps: readItemChainsFn.Step[] = [
			{
				path,
				kind: "merge",
				ownerId: root.id,
				targetId: merge.target.itemId,
				mergeIndex,
				sourceAction: merge.action,
				targetEffect: merge.effect,
				conditional: merge.action === "spend" || merge.effect === "spend",
				disabled: false,
				inputCount: 0,
				branches,
				incomplete: omitted > before,
			},
		];
		chains.push({
			id: path,
			kind: "merge",
			ownerId: root.id,
			targetId: merge.target.itemId,
			steps,
		});
	}
	if (root.clock !== undefined) {
		const steps = clockFn(root, "clock", 0, [
			root.id,
		]);
		chains.push({
			id: "clock",
			kind: "clock",
			ownerId: root.id,
			steps,
		});
	}
	return {
		chains: chains.map((chain) => ({
			...chain,
			outcomes: outcomesFn(chain.steps).concat(
				chain.kind === "clock" && root.clock?.durationMs === undefined
					? [
							{
								itemId: root.id,
								stop: "ongoing",
								periodic: false,
								conditional:
									!root.clock?.enable || (root.clock?.rules.length ?? 0) > 0,
							},
						]
					: [],
			),
		})),
		truncated,
	};
};
