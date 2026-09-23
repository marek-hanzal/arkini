import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";

export namespace readItemChainsFn {
	export type Stop = "final" | "retained" | "spent" | "cycle" | "depth" | "missing" | "ongoing";
	export interface OutputPath {
		readonly set: number;
		readonly setWeight: number;
		readonly alternative: boolean;
		readonly roll: number;
		readonly type: "guaranteed" | "chance";
		readonly chance?: number;
		readonly conditional: boolean;
	}
	export interface Node {
		readonly path: string;
		readonly itemUid: string;
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
		readonly ownerItemUid: string;
		readonly targetItemUid?: string;
		readonly mergeIndex?: number;
		readonly lineId?: string;
		readonly lineTitle?: string;
		readonly clockWeight?: number;
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
		readonly itemUid?: string;
		readonly stop: Stop | "no-output";
		readonly periodic: boolean;
		readonly conditional: boolean;
	}
	export interface Chain {
		readonly id: string;
		readonly kind: "merge" | "clock";
		readonly space?: number;
		readonly ownerItemUid: string;
		readonly targetItemUid?: string;
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
		itemUid: string,
		path: string,
		depth: number,
		ancestors: readonly string[],
		quantity?: readItemChainsFn.Node["quantity"],
		output?: readItemChainsFn.OutputPath,
		preserved?: "retained" | "spent",
	): readItemChainsFn.Node => {
		const item = items[itemUid];
		const stop: readItemChainsFn.Stop | undefined =
			item === undefined
				? "missing"
				: preserved !== undefined
					? preserved
					: item.clock === undefined
						? "final"
						: ancestors.includes(itemUid)
							? "cycle"
							: depth >= depthLimit
								? "depth"
								: undefined;
		return {
			itemUid,
			path,
			quantity,
			output,
			stop: stop ?? (item?.clock?.durationMs === undefined ? "ongoing" : undefined),
			steps:
				stop === undefined && item !== undefined
					? clockFn(item, path, depth, [
							...ancestors,
							itemUid,
						])
					: [],
		};
	};
	const outputFn = (
		output: OutcomeTableSchema.Type | undefined,
		path: string,
		depth: number,
		ancestors: readonly string[],
	): readItemChainsFn.Node[] => {
		const nodes: readItemChainsFn.Node[] = [];
		const appendFn = (
			drop: OutcomeSchema.Type,
			suffix: string,
			meta: readItemChainsFn.OutputPath,
		) => {
			if (drop.type !== "item" || drop.quantity.max === 0) return;
			if (remaining <= 0) {
				truncated = true;
				omitted++;
				return;
			}
			remaining--;
			nodes.push(
				nodeFn(drop.itemUid, `${path}/${suffix}`, depth, ancestors, drop.quantity, {
					...meta,
					conditional: meta.conditional || drop.rules.length > 0,
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
					conditional: set.rules.length > 0,
					chance: roll.type === "chance" ? roll.chance : undefined,
				};
				for (const [dropIndex, drop] of roll.outcome.entries())
					appendFn(drop, `${setIndex}/${rollIndex}/${dropIndex}`, meta);
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
		const lines = item.lines.filter((candidate) => candidate.clock);
		if (
			clock.intervalMs !== undefined &&
			(clock.durationMs === undefined || clock.intervalMs <= clock.durationMs)
		) {
			for (const [lineIndex, line] of lines.entries()) {
				if (remaining <= 0) {
					truncated = true;
					omitted++;
					break;
				}
				remaining--;
				const nextPath = `${path}/pulse/${lineIndex}`;
				const before = omitted;
				const branches = outputFn(line.outcome, nextPath, depth + 1, ancestors);
				steps.push({
					path: nextPath,
					kind: "pulse",
					ownerItemUid: item.uid,
					lineId: line.id,
					lineTitle: line.title,
					clockWeight: line.clockWeight,
					timeMs: clock.intervalMs,
					lifetimeMs: clock.durationMs,
					runtimeMs: line.runtimeMs,
					conditional:
						clock.rules.length > 0 ||
						lines.length > 1 ||
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
		}
		if (clock.durationMs !== undefined) {
			const nextPath = `${path}/expiry`;
			const before = omitted;
			const branches = outputFn(clock.onExpire, nextPath, depth + 1, ancestors);
			steps.push({
				path: nextPath,
				kind: "expiry",
				ownerItemUid: item.uid,
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
							itemUid: node.itemUid,
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
						other.itemUid === outcome.itemUid &&
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
		const targetItemUid = merge.action === "space" ? root.uid : merge.target.itemUid;
		// Receiver-owned transport retains an anonymous source; only its concrete target consequences are projected.
		if (merge.action !== "space") {
			if (seenTargets.has(targetItemUid)) continue;
			seenTargets.add(targetItemUid);
		}
		const path = `merge/${mergeIndex}`;
		const before = omitted;
		const branches: readItemChainsFn.Node[] = [];
		if (merge.effect === "replace")
			branches.push(nodeFn(merge.result, `${path}/replacement`, 1, []));
		else if (merge.effect === "keep" || merge.effect === "spend")
			branches.push(
				nodeFn(
					targetItemUid,
					`${path}/target`,
					1,
					[],
					undefined,
					undefined,
					merge.effect === "keep" ? "retained" : "spent",
				),
			);
		if (merge.action !== "consume" && merge.action !== "space")
			branches.push(
				nodeFn(
					root.uid,
					`${path}/source`,
					1,
					[],
					undefined,
					undefined,
					merge.action === "use" ? "retained" : "spent",
				),
			);
		branches.push(...outputFn(merge.outcome, `${path}/output`, 1, []));
		// Spending may exhaust either participant. These are conditional merge side
		// effects; existing identities are not restarted with a fresh Clock.
		for (const [role, participant] of [
			[
				"source",
				merge.action === "spend" ? root : undefined,
			],
			[
				"target",
				merge.effect === "spend" ? items[targetItemUid] : undefined,
			],
		] as const) {
			if (participant?.units?.outcome === undefined) continue;
			branches.push(
				...outputFn(participant.units.outcome, `${path}/${role}-depletion`, 1, []).map(
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
				ownerItemUid: root.uid,
				targetItemUid: targetItemUid,
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
			...(merge.action === "space"
				? {
						space: merge.space,
					}
				: {}),
			ownerItemUid: root.uid,
			targetItemUid: targetItemUid,
			steps,
		});
	}
	if (root.clock !== undefined) {
		const steps = clockFn(root, "clock", 0, [
			root.uid,
		]);
		chains.push({
			id: "clock",
			kind: "clock",
			ownerItemUid: root.uid,
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
								itemUid: root.uid,
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
