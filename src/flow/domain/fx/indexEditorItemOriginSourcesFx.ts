import { Effect } from "effect";

import type {
	EditorItemOriginFlowProgress,
	EditorItemOriginItemNode,
} from "~/flow/domain/EditorItemOriginFlow";
import { type EditorItemOriginSource } from "~/flow/domain/EditorItemOriginSource";
import { createEditorAcquisitionGraphFn } from "~/flow/domain/fn/createEditorAcquisitionGraphFn";
import { readEditorItemOriginSourcesFn } from "~/flow/domain/fn/readEditorItemOriginSourcesFn";
import { reportEditorItemOriginFlowProgressFx } from "~/flow/domain/fx/reportEditorItemOriginFlowProgressFx";
import { yieldEditorItemOriginFlowFx } from "~/flow/domain/fx/yieldEditorItemOriginFlowFx";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const unique = <Value>(values: ReadonlyArray<Value>): Value[] => [
	...new Set(values),
];

export interface EditorItemOriginSourceIndex {
	readonly items: ReadonlyMap<string, ItemSchema.Type>;
	readonly sources: ReadonlyArray<EditorItemOriginSource>;
	readonly sourcesById: ReadonlyMap<string, EditorItemOriginSource>;
	readonly sourcesByOutput: ReadonlyMap<string, ReadonlyArray<EditorItemOriginSource>>;
	readonly sourcesByOwner: ReadonlyMap<string, ReadonlyArray<EditorItemOriginSource>>;
	readonly starters: ReadonlyMap<
		string,
		ReadonlySet<EditorItemOriginItemNode["starterScopes"][number]>
	>;
}

/** Indexes authored items, starting scopes, and every concrete acquisition source. */
export const indexEditorItemOriginSourcesFx = Effect.fn("indexEditorItemOriginSourcesFx")(
	function* ({
		config,
		onProgress,
	}: {
		readonly config: GameConfigSchema.Type;
		readonly onProgress?: (progress: EditorItemOriginFlowProgress) => void;
	}) {
		yield* reportEditorItemOriginFlowProgressFx(onProgress, "indexing", 0);
		yield* yieldEditorItemOriginFlowFx();
		const items = new Map(
			Object.values(config.items).map((item) => [
				item.id,
				item,
			]),
		);
		const starters = new Map<string, Set<EditorItemOriginItemNode["starterScopes"][number]>>();
		const addStarter = (
			itemId: string,
			scope: EditorItemOriginItemNode["starterScopes"][number],
		) => {
			const scopes = starters.get(itemId) ?? new Set();
			scopes.add(scope);
			starters.set(itemId, scopes);
		};
		for (const entry of config.start.board) addStarter(entry.itemId, "Board");
		for (const entry of config.start.inventory) addStarter(entry.itemId, "Inventory");
		for (const entry of config.start.toolbar) addStarter(entry.itemId, "Toolbar");

		const graph = createEditorAcquisitionGraphFn(config);
		const sources = readEditorItemOriginSourcesFn(graph);
		yield* reportEditorItemOriginFlowProgressFx(onProgress, "indexing", 28);
		yield* yieldEditorItemOriginFlowFx();
		const sourcesByOutput = new Map<string, EditorItemOriginSource[]>();
		const sourcesByOwner = new Map<string, EditorItemOriginSource[]>();
		const sourcesById = new Map(
			sources.flatMap((source) =>
				[
					source.id,
					...source.routeIds,
				].map(
					(id) =>
						[
							id,
							source,
						] as const,
				),
			),
		);
		for (const [index, source] of sources.entries()) {
			const ownerSources = sourcesByOwner.get(source.ownerItemId) ?? [];
			ownerSources.push(source);
			sourcesByOwner.set(source.ownerItemId, ownerSources);
			for (const outputItemId of unique(source.outputs.map(({ itemId }) => itemId))) {
				const matches = sourcesByOutput.get(outputItemId) ?? [];
				matches.push(source);
				sourcesByOutput.set(outputItemId, matches);
			}
			if ((index + 1) % 64 === 0) {
				yield* reportEditorItemOriginFlowProgressFx(
					onProgress,
					"indexing",
					28 + ((index + 1) / Math.max(1, sources.length)) * 12,
				);
				yield* yieldEditorItemOriginFlowFx();
			}
		}
		return {
			items,
			sources,
			sourcesById,
			sourcesByOutput,
			sourcesByOwner,
			starters,
		} satisfies EditorItemOriginSourceIndex;
	},
);
