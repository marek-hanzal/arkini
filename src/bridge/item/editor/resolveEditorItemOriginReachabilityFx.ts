import { Effect } from "effect";

import type { EditorItemOriginFlowProgress } from "~/bridge/item/editor/EditorItemOriginFlow";
import type { EditorItemOriginSourceIndex } from "~/bridge/item/editor/indexEditorItemOriginSourcesFx";
import { reportEditorItemOriginFlowProgressFx } from "~/bridge/item/editor/reportEditorItemOriginFlowProgressFx";
import { yieldEditorItemOriginFlowFx } from "~/bridge/item/editor/yieldEditorItemOriginFlowFx";

const unique = <Value>(values: ReadonlyArray<Value>): Value[] => [
	...new Set(values),
];

/** Resolves which acquisition source first makes each item reachable from authored starters. */
export const resolveEditorItemOriginReachabilityFx = Effect.fn(
	"resolveEditorItemOriginReachabilityFx",
)(function* ({
	onProgress,
	sources,
	starters,
}: Pick<EditorItemOriginSourceIndex, "sources" | "starters"> & {
	readonly onProgress?: (progress: EditorItemOriginFlowProgress) => void;
}) {
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "resolving", 44);
	yield* yieldEditorItemOriginFlowFx();
	const reachableItems = new Set<string>();
	const reachableSources = new Set<string>();
	const acquisitionSourceByItem = new Map<string, string>();
	const waitingSources = new Map<string, (typeof sources)[number][]>();
	const remainingRequirements = new Map<string, number>();
	const pendingReachableItems: Array<{
		readonly itemId: string;
		readonly sourceId?: string;
	}> = [
		...[
			...starters.keys(),
		].map((itemId) => ({
			itemId,
		})),
	];
	for (const [index, source] of sources.entries()) {
		const requirementItemIds = unique(source.requirementItemIds);
		remainingRequirements.set(source.id, requirementItemIds.length);
		for (const requirementItemId of requirementItemIds) {
			const waiting = waitingSources.get(requirementItemId) ?? [];
			waiting.push(source);
			waitingSources.set(requirementItemId, waiting);
		}
		if (requirementItemIds.length === 0) {
			reachableSources.add(source.id);
			pendingReachableItems.push(
				...unique(source.outputs.map(({ itemId }) => itemId)).map((itemId) => ({
					itemId,
					sourceId: source.id,
				})),
			);
		}
		if ((index + 1) % 64 === 0) {
			yield* reportEditorItemOriginFlowProgressFx(
				onProgress,
				"resolving",
				44 + ((index + 1) / Math.max(1, sources.length)) * 10,
			);
			yield* yieldEditorItemOriginFlowFx();
		}
	}
	let resolvedItemCount = 0;
	for (let pendingIndex = 0; pendingIndex < pendingReachableItems.length; pendingIndex += 1) {
		const pendingItem = pendingReachableItems[pendingIndex];
		if (pendingItem === undefined || reachableItems.has(pendingItem.itemId)) continue;
		reachableItems.add(pendingItem.itemId);
		if (pendingItem.sourceId !== undefined)
			acquisitionSourceByItem.set(pendingItem.itemId, pendingItem.sourceId);
		for (const source of waitingSources.get(pendingItem.itemId) ?? []) {
			if (reachableSources.has(source.id)) continue;
			const remaining = (remainingRequirements.get(source.id) ?? 1) - 1;
			remainingRequirements.set(source.id, remaining);
			if (remaining !== 0) continue;
			reachableSources.add(source.id);
			pendingReachableItems.push(
				...unique(source.outputs.map(({ itemId }) => itemId)).map((itemId) => ({
					itemId,
					sourceId: source.id,
				})),
			);
		}
		resolvedItemCount += 1;
		if (resolvedItemCount % 32 === 0) {
			yield* reportEditorItemOriginFlowProgressFx(
				onProgress,
				"resolving",
				54 + (resolvedItemCount / Math.max(1, pendingReachableItems.length)) * 18,
			);
			yield* yieldEditorItemOriginFlowFx();
		}
	}
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "resolving", 74);
	yield* yieldEditorItemOriginFlowFx();
	return acquisitionSourceByItem as ReadonlyMap<string, string>;
});
