import { Effect } from "effect";

import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { GameConfigSchema as GameConfig } from "~/game-config/schema/GameConfigSchema";
import { readDeleteBlockersFn } from "~/item-authoring/fn/readDeleteBlockersFn";

type StartSurface = "board" | "inventory" | "toolbar";

interface ItemCleanup {
	readonly actionInputIndexes: Set<number>;
	readonly actionRuleIndexes: Set<number>;
	readonly mergeIndexes: Set<number>;
	readonly lineIndexes: Set<number>;
	removeUnitsOutput: boolean;
	removeExpiryOutput: boolean;
}

export namespace forceDeleteFx {
	export interface Impact {
		readonly removedActionInputs: ReadonlyArray<{
			readonly ownerItemId: string;
			readonly inputNumber: number;
		}>;
		readonly removedActionRules: ReadonlyArray<{
			readonly ownerItemId: string;
			readonly ruleNumber: number;
		}>;
		readonly removedUnitOutputOwnerIds: ReadonlyArray<string>;
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

	export interface Props {
		readonly config: GameConfigSchema.Type;
		readonly itemId: string;
	}

	export interface Result {
		readonly config: GameConfigSchema.Type;
		readonly impact: Impact;
	}
}

const createItemCleanupFn = (): ItemCleanup => ({
	actionInputIndexes: new Set(),
	actionRuleIndexes: new Set(),
	mergeIndexes: new Set(),
	lineIndexes: new Set(),
	removeUnitsOutput: false,
	removeExpiryOutput: false,
});

/** Mechanically removes one item and every authored structure that directly references it. */
export const forceDeleteFx = Effect.fn("forceDeleteEditorItemFx")(function* ({
	config,
	itemId,
}: forceDeleteFx.Props) {
	const blockers = readDeleteBlockersFn({
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
		const [root, second, third, fourth, fifth] = blocker.path;
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
		const cleanup = itemCleanups.get(second) ?? createItemCleanupFn();
		itemCleanups.set(second, cleanup);
		switch (third) {
			case "action":
				if (typeof fifth !== "number" || (fourth !== "input" && fourth !== "rules"))
					throw new Error(`Invalid action reference path ${blocker.path.join(".")}.`);
				(fourth === "input" ? cleanup.actionInputIndexes : cleanup.actionRuleIndexes).add(
					fifth,
				);
				break;
			case "clock":
				if (fourth === "onExpire") cleanup.removeExpiryOutput = true;
				else if (fourth === "rules" && typeof fifth === "number")
					cleanup.actionRuleIndexes.add(fifth);
				else throw new Error(`Invalid clock reference path ${blocker.path.join(".")}.`);
				break;
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
			case "units":
				cleanup.removeUnitsOutput = true;
				break;
			default:
				throw new Error(
					`Unsupported item delete reference path ${blocker.path.join(".")}.`,
				);
		}
	}

	const removedActionInputs: Array<{
		ownerItemId: string;
		inputNumber: number;
	}> = [];
	const removedActionRules: Array<{
		ownerItemId: string;
		ruleNumber: number;
	}> = [];
	const removedUnitOutputOwnerIds: string[] = [];
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
		const candidate: Record<string, unknown> = {
			...owner,
		};
		if (
			owner.action !== undefined &&
			(cleanup.actionInputIndexes.size > 0 || cleanup.actionRuleIndexes.size > 0)
		) {
			candidate.action = {
				...owner.action,
				input: owner.action.input.filter(
					(_input, index) => !cleanup.actionInputIndexes.has(index),
				),
				rules: owner.action.rules.filter(
					(_rule, index) => !cleanup.actionRuleIndexes.has(index),
				),
			};
		}
		if (owner.clock !== undefined && cleanup.actionRuleIndexes.size > 0)
			candidate.clock = {
				...owner.clock,
				rules: owner.clock.rules.filter(
					(_rule, index) => !cleanup.actionRuleIndexes.has(index),
				),
			};
		for (const index of cleanup.actionInputIndexes)
			removedActionInputs.push({
				ownerItemId,
				inputNumber: index + 1,
			});
		for (const index of cleanup.actionRuleIndexes)
			removedActionRules.push({
				ownerItemId,
				ruleNumber: index + 1,
			});

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
		if (cleanup.removeUnitsOutput && owner.units !== undefined) {
			candidate.units = {
				...owner.units,
				output: undefined,
			};
			removedUnitOutputOwnerIds.push(ownerItemId);
		}
		if (cleanup.removeExpiryOutput) {
			if (owner.clock !== undefined)
				candidate.clock = {
					...(candidate.clock as typeof owner.clock),
					onExpire: undefined,
				};
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
			removedActionInputs,
			removedActionRules,
			removedUnitOutputOwnerIds,
			removedExpiryOutputOwnerIds,
			removedLines,
			removedMergeRules,
			removedStartEntries: {
				board: startIndexes.board.size,
				inventory: startIndexes.inventory.size,
				toolbar: startIndexes.toolbar.size,
			},
		},
	};
});
