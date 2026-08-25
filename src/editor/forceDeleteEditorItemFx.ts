import { Effect } from "effect";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { GameConfigSchema as GameConfig } from "~/engine/schema/GameConfigSchema";
import { readEditorItemDeleteBlockersFx } from "~/editor/readEditorItemDeleteBlockersFx";

type StartSurface = "board" | "inventory" | "toolbar";

interface ItemCleanup {
	readonly mergeIndexes: Set<number>;
	readonly lineIndexes: Set<number>;
	removeChargesOutput: boolean;
	removeExpiryOutput: boolean;
	removeLine: boolean;
}

export interface EditorItemForceDeleteImpact {
	readonly deletedOwnerItemIds: ReadonlyArray<string>;
	readonly removedChargeOutputOwnerIds: ReadonlyArray<string>;
	readonly removedExpiryOutputOwnerIds: ReadonlyArray<string>;
	readonly removedLines: ReadonlyArray<{
		readonly ownerItemId: string;
		readonly lineId: string;
		readonly title: string;
	}>;
	readonly removedMergeRules: ReadonlyArray<{
		readonly ownerItemId: string;
		readonly ruleNumber: number;
	}>;
	readonly removedStartEntries: Readonly<Record<StartSurface, number>>;
}

export interface EditorItemForceDeleteResult {
	readonly config: GameConfigSchema.Type;
	readonly impact: EditorItemForceDeleteImpact;
}

const createItemCleanup = (): ItemCleanup => ({
	mergeIndexes: new Set(),
	lineIndexes: new Set(),
	removeChargesOutput: false,
	removeExpiryOutput: false,
	removeLine: false,
});

/** Mechanically removes one item and every authored structure that directly references it. */
export const forceDeleteEditorItemFx = Effect.fn("forceDeleteEditorItemFx")(function* ({
	config,
	itemId,
}: {
	readonly config: GameConfigSchema.Type;
	readonly itemId: string;
}) {
	const blockers = yield* readEditorItemDeleteBlockersFx({
		config,
		itemId,
	});
	const startIndexes: Record<StartSurface, Set<number>> = {
		board: new Set(),
		inventory: new Set(),
		toolbar: new Set(),
	};
	const itemCleanups = new Map<string, ItemCleanup>();
	for (const blocker of blockers) {
		const [root, second, third, fourth] = blocker.path;
		if (
			root === "start" &&
			(second === "board" || second === "inventory" || second === "toolbar") &&
			typeof third === "number"
		) {
			startIndexes[second].add(third);
			continue;
		}
		if (root !== "items" || typeof second !== "string" || typeof third !== "string")
			throw new Error(`Unsupported item delete reference path ${blocker.path.join(".")}.`);
		const cleanup = itemCleanups.get(second) ?? createItemCleanup();
		itemCleanups.set(second, cleanup);
		switch (third) {
			case "merge":
				if (typeof fourth !== "number")
					throw new Error(`Invalid merge reference path ${blocker.path.join(".")}.`);
				cleanup.mergeIndexes.add(fourth);
				break;
			case "lines":
				if (typeof fourth !== "number")
					throw new Error(`Invalid line reference path ${blocker.path.join(".")}.`);
				cleanup.lineIndexes.add(fourth);
				break;
			case "line":
				cleanup.removeLine = true;
				break;
			case "charges":
				cleanup.removeChargesOutput = true;
				break;
			case "output":
				cleanup.removeExpiryOutput = true;
				break;
			default:
				throw new Error(
					`Unsupported item delete reference path ${blocker.path.join(".")}.`,
				);
		}
	}

	const deletedOwnerItemIds: string[] = [];
	const removedChargeOutputOwnerIds: string[] = [];
	const removedExpiryOutputOwnerIds: string[] = [];
	const removedLines: Array<{
		ownerItemId: string;
		lineId: string;
		title: string;
	}> = [];
	const removedMergeRules: Array<{
		ownerItemId: string;
		ruleNumber: number;
	}> = [];
	const items: Record<string, unknown> = {
		...config.items,
	};
	delete items[itemId];

	for (const [ownerItemId, cleanup] of itemCleanups) {
		const owner = config.items[ownerItemId];
		if (owner === undefined) continue;
		const mustDeleteOwner =
			cleanup.removeLine ||
			(owner.type === "producer" && cleanup.lineIndexes.size === owner.lines.length);
		if (mustDeleteOwner) {
			delete items[ownerItemId];
			deletedOwnerItemIds.push(ownerItemId);
			continue;
		}

		const candidate: Record<string, unknown> = {
			...owner,
		};
		if (cleanup.mergeIndexes.size > 0) {
			const merge = (owner.merge ?? []).filter(
				(_rule, index) => !cleanup.mergeIndexes.has(index),
			);
			candidate.merge = merge.length === 0 ? undefined : merge;
			for (const index of cleanup.mergeIndexes)
				removedMergeRules.push({
					ownerItemId,
					ruleNumber: index + 1,
				});
		}
		if (cleanup.lineIndexes.size > 0 && "lines" in owner) {
			const lines = (owner.lines ?? []).filter(
				(_line, index) => !cleanup.lineIndexes.has(index),
			);
			candidate.lines = lines.length === 0 ? undefined : lines;
			for (const index of cleanup.lineIndexes) {
				const line = owner.lines?.[index];
				if (line !== undefined)
					removedLines.push({
						ownerItemId,
						lineId: line.id,
						title: line.title,
					});
			}
		}
		if (cleanup.removeChargesOutput && owner.charges !== undefined) {
			candidate.charges = {
				...owner.charges,
				output: undefined,
			};
			removedChargeOutputOwnerIds.push(ownerItemId);
		}
		if (cleanup.removeExpiryOutput && "output" in owner) {
			candidate.output = undefined;
			removedExpiryOutputOwnerIds.push(ownerItemId);
		}
		items[ownerItemId] = candidate;
	}

	return {
		config: GameConfig.parse({
			...config,
			start: {
				...config.start,
				board: config.start.board.filter((_entry, index) => !startIndexes.board.has(index)),
				inventory: config.start.inventory.filter(
					(_entry, index) => !startIndexes.inventory.has(index),
				),
				toolbar: config.start.toolbar.filter(
					(_entry, index) => !startIndexes.toolbar.has(index),
				),
			},
			items,
		}),
		impact: {
			deletedOwnerItemIds,
			removedChargeOutputOwnerIds,
			removedExpiryOutputOwnerIds,
			removedLines,
			removedMergeRules,
			removedStartEntries: {
				board: startIndexes.board.size,
				inventory: startIndexes.inventory.size,
				toolbar: startIndexes.toolbar.size,
			},
		},
	} satisfies EditorItemForceDeleteResult;
});
