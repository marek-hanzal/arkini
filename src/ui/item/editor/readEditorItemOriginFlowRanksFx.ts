import { Effect } from "effect";

import type { EditorItemOriginFlowLayoutInput } from "~/ui/item/editor/editorItemOriginFlowLayout";
import type { EditorItemOriginFlowDirectedPair } from "~/ui/item/editor/readEditorItemOriginFlowTopologyFx";

/** Collapses feedback cycles and assigns a stable forward rank to each flow node. */
export const readEditorItemOriginFlowRanksFx = Effect.fn("readEditorItemOriginFlowRanksFx")(
	(
		flow: EditorItemOriginFlowLayoutInput,
		directedPairs: ReadonlyArray<EditorItemOriginFlowDirectedPair>,
	) =>
		Effect.sync(() => {
			const nodeIds = flow.nodes
				.map(({ id }) => id)
				.sort((left, right) => left.localeCompare(right));
			const outgoing = new Map(
				nodeIds.map(
					(id) =>
						[
							id,
							[] as string[],
						] as const,
				),
			);
			for (const pair of directedPairs) outgoing.get(pair.source)?.push(pair.target);
			for (const targets of outgoing.values())
				targets.sort((left, right) => left.localeCompare(right));

			let nextIndex = 0;
			const stack: string[] = [];
			const onStack = new Set<string>();
			const indexById = new Map<string, number>();
			const lowById = new Map<string, number>();
			const componentById = new Map<string, number>();
			const components: string[][] = [];

			const visit = (id: string) => {
				indexById.set(id, nextIndex);
				lowById.set(id, nextIndex);
				nextIndex += 1;
				stack.push(id);
				onStack.add(id);
				for (const target of outgoing.get(id) ?? []) {
					if (!indexById.has(target)) {
						visit(target);
						lowById.set(id, Math.min(lowById.get(id)!, lowById.get(target)!));
					} else if (onStack.has(target)) {
						lowById.set(id, Math.min(lowById.get(id)!, indexById.get(target)!));
					}
				}
				if (lowById.get(id) !== indexById.get(id)) return;
				const members: string[] = [];
				while (stack.length > 0) {
					const member = stack.pop()!;
					onStack.delete(member);
					members.push(member);
					componentById.set(member, components.length);
					if (member === id) break;
				}
				members.sort((left, right) => left.localeCompare(right));
				components.push(members);
			};
			for (const id of nodeIds) if (!indexById.has(id)) visit(id);

			const dag = new Map(
				components.map(
					(_, index) =>
						[
							index,
							new Set<number>(),
						] as const,
				),
			);
			const inDegree = new Map<number, number>(
				components.map(
					(_, index) =>
						[
							index,
							0,
						] as const,
				),
			);
			for (const pair of directedPairs) {
				const source = componentById.get(pair.source)!;
				const target = componentById.get(pair.target)!;
				if (source === target || dag.get(source)!.has(target)) continue;
				dag.get(source)!.add(target);
				inDegree.set(target, inDegree.get(target)! + 1);
			}
			const queue = [
				...inDegree,
			]
				.filter(([, value]) => value === 0)
				.map(([component]) => component)
				.sort((left, right) => left - right);
			const rankByComponent = new Map<number, number>(
				components.map(
					(_, index) =>
						[
							index,
							0,
						] as const,
				),
			);
			while (queue.length > 0) {
				const component = queue.shift()!;
				for (const target of [
					...dag.get(component)!,
				].sort((left, right) => left - right)) {
					rankByComponent.set(
						target,
						Math.max(rankByComponent.get(target)!, rankByComponent.get(component)! + 1),
					);
					inDegree.set(target, inDegree.get(target)! - 1);
					if (inDegree.get(target) === 0) {
						queue.push(target);
						queue.sort((left, right) => left - right);
					}
				}
			}
			return new Map(
				nodeIds.map(
					(id) =>
						[
							id,
							rankByComponent.get(componentById.get(id)!) ?? 0,
						] as const,
				),
			);
		}),
);
