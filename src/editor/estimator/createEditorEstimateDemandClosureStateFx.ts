import { Effect } from "effect";

import type { EditorEstimatePolicy } from "~/editor/estimator/createEditorEstimatePolicyFx";
import type { EditorEstimateSelectedRoute } from "~/editor/estimator/projectEditorEstimateRouteStepFx";

export interface EditorEstimateDemandClosureState {
	readonly consumables: Map<string, number>;
	readonly dependencies: Map<string, Set<string>>;
	readonly ongoing: Map<string, number>;
	readonly oneTime: Map<string, number>;
	readonly pending: string[];
	readonly selected: Map<string, EditorEstimateSelectedRoute>;
	readonly dequeue: (index: number) => string | undefined;
	readonly missingQuantity: (id: string) => number;
	readonly readCyclePath: (id: string, dependencyId: string) => ReadonlyArray<string> | undefined;
	readonly readRequiredQuantities: () => ReadonlyMap<string, number>;
	readonly select: (id: string, next: EditorEstimateSelectedRoute) => void;
}

const add = (target: Map<string, number>, factId: string, quantity: number) =>
	target.set(factId, (target.get(factId) ?? 0) + quantity);
const maximize = (target: Map<string, number>, factId: string, quantity: number) =>
	target.set(factId, Math.max(target.get(factId) ?? 0, quantity));

/** Creates mutable monotone demand state for one candidate materialization attempt. */
export const createEditorEstimateDemandClosureStateFx = Effect.fn(
	"createEditorEstimateDemandClosureStateFx",
)(
	({
		factId,
		policy,
		quantity,
	}: {
		readonly factId: string;
		readonly policy: EditorEstimatePolicy;
		readonly quantity: number;
	}) =>
		Effect.sync((): EditorEstimateDemandClosureState => {
			const consumables = new Map<string, number>();
			const concurrent = new Map<string, number>();
			const dependencies = new Map<string, Set<string>>();
			const ongoing = new Map<string, number>();
			const oneTime = new Map<string, number>();
			const pending = [
				factId,
			];
			const selected = new Map<string, EditorEstimateSelectedRoute>();
			const external = new Map([
				[
					factId,
					quantity,
				],
			]);
			const queued = new Set(pending);
			const recurrenceCredit = new Map<string, number>();
			const enqueue = (id: string) => {
				if (queued.has(id)) return;
				queued.add(id);
				pending.push(id);
			};
			const requiredQuantity = (id: string) =>
				Math.max(
					(external.get(id) ?? 0) + (consumables.get(id) ?? 0),
					concurrent.get(id) ?? 0,
				);
			const addContributions = (plan: EditorEstimateSelectedRoute) => {
				for (const group of plan.groups) {
					add(consumables, group.factId, group.consumed);
					maximize(
						concurrent,
						group.factId,
						group.consumed + Math.max(group.oneTime, group.ongoing),
					);
					maximize(oneTime, group.factId, group.oneTime);
					maximize(ongoing, group.factId, group.ongoing);
					if (plan.recurrenceFactIds.has(group.factId))
						add(
							recurrenceCredit,
							group.factId,
							group.consumed + Math.max(group.oneTime, group.ongoing),
						);
				}
			};
			const rebuildContributions = () => {
				const reachable = new Set<string>();
				const remaining = [
					factId,
				];
				while (remaining.length > 0) {
					const current = remaining.pop();
					if (current === undefined || reachable.has(current)) continue;
					reachable.add(current);
					remaining.push(...(dependencies.get(current) ?? []));
				}
				for (const id of [
					...selected.keys(),
				])
					if (!reachable.has(id)) {
						selected.delete(id);
						dependencies.delete(id);
					}
				consumables.clear();
				concurrent.clear();
				oneTime.clear();
				ongoing.clear();
				recurrenceCredit.clear();
				for (const plan of selected.values()) addContributions(plan);
			};
			return {
				consumables,
				dependencies,
				ongoing,
				oneTime,
				pending,
				selected,
				dequeue: (index) => {
					const id = pending[index];
					if (id !== undefined) queued.delete(id);
					return id;
				},
				missingQuantity: (id) => {
					const root = policy.roots.get(id);
					const rootCredit =
						root === "unbounded"
							? requiredQuantity(id)
							: Math.min(root ?? 0, requiredQuantity(id));
					return Math.max(
						0,
						requiredQuantity(id) -
							rootCredit -
							(id === factId ? 0 : (recurrenceCredit.get(id) ?? 0)),
					);
				},
				readCyclePath: (id, dependencyId) => {
					const stack: Array<{
						readonly id: string;
						readonly path: ReadonlyArray<string>;
					}> = [
						{
							id: dependencyId,
							path: [
								dependencyId,
							],
						},
					];
					const visited = new Set<string>();
					while (stack.length > 0) {
						const current = stack.pop();
						if (current === undefined) continue;
						if (current.id === id)
							return [
								id,
								...current.path,
							];
						if (visited.has(current.id)) continue;
						visited.add(current.id);
						for (const next of dependencies.get(current.id) ?? [])
							stack.push({
								id: next,
								path: [
									...current.path,
									next,
								],
							});
					}
					return undefined;
				},
				readRequiredQuantities: () =>
					new Map(
						[
							...selected.keys(),
						].map((id) => [
							id,
							requiredQuantity(id),
						]),
					),
				select: (id, next) => {
					const previous = selected.get(id);
					selected.set(id, next);
					dependencies.set(
						id,
						new Set(
							next.groups
								.map((group) => group.factId)
								.filter(
									(dependencyId) => !next.recurrenceFactIds.has(dependencyId),
								),
						),
					);
					const affected = new Set(next.groups.map((group) => group.factId));
					if (previous === undefined) addContributions(next);
					else {
						for (const group of previous.groups) affected.add(group.factId);
						for (const selectedId of selected.keys()) affected.add(selectedId);
						rebuildContributions();
					}
					for (const affectedId of affected) enqueue(affectedId);
				},
			};
		}),
);
