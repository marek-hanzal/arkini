import { Effect } from "effect";

import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { GameConfigSchema as GameConfig } from "~/game-config/schema/GameConfigSchema";
import { readDeleteBlockersFn } from "~/item-authoring/fn/readDeleteBlockersFn";

interface ItemCleanup {
	readonly clockRuleIndexes: Set<number>;
	readonly mergeIndexes: Set<number>;
	readonly lineIndexes: Set<number>;
	removeUnitsOutcome: boolean;
	removeExpiryOutcome: boolean;
}

export namespace forceDeleteFx {
	export interface Impact {
		readonly removedClockRules: ReadonlyArray<{
			readonly ownerItemUid: string;
			readonly ruleNumber: number;
		}>;
		readonly removedUnitOutcomeOwnerIds: ReadonlyArray<string>;
		readonly removedExpiryOutcomeOwnerIds: ReadonlyArray<string>;
		readonly removedLines: ReadonlyArray<{
			readonly ownerItemUid: string;
			readonly lineUid: string;
			readonly title: string;
		}>;
		readonly removedMergeRules: ReadonlyArray<{
			readonly ownerItemUid: string;
			readonly ruleNumber: number;
		}>;
		readonly removedTemplateEntries: ReadonlyArray<{
			readonly templateUid: string;
			readonly title: string;
			readonly count: number;
		}>;
	}

	export interface Props {
		readonly config: GameConfigSchema.Type;
		readonly itemUid: string;
	}

	export interface Result {
		readonly config: GameConfigSchema.Type;
		readonly impact: Impact;
	}
}

const createItemCleanupFn = (): ItemCleanup => ({
	clockRuleIndexes: new Set(),
	mergeIndexes: new Set(),
	lineIndexes: new Set(),
	removeUnitsOutcome: false,
	removeExpiryOutcome: false,
});

/** Mechanically removes one item and every authored structure that directly references it. */
export const forceDeleteFx = Effect.fn("forceDeleteEditorItemFx")(function* ({
	config,
	itemUid,
}: forceDeleteFx.Props) {
	const blockers = readDeleteBlockersFn({
		config,
		itemUid,
	});
	const itemCleanups = new Map<string, ItemCleanup>();
	for (const blocker of blockers) {
		const [root, second, third, fourth, fifth] = blocker.path;
		if (root === "templates") continue;
		if (root !== "items" || typeof second !== "string" || typeof third !== "string")
			throw new Error(`Unsupported item delete reference path ${blocker.path.join(".")}.`);
		const cleanup = itemCleanups.get(second) ?? createItemCleanupFn();
		itemCleanups.set(second, cleanup);
		switch (third) {
			case "clock":
				if (fourth === "onExpire") cleanup.removeExpiryOutcome = true;
				else if (fourth === "rules" && typeof fifth === "number")
					cleanup.clockRuleIndexes.add(fifth);
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
				cleanup.removeUnitsOutcome = true;
				break;
			default:
				throw new Error(
					`Unsupported item delete reference path ${blocker.path.join(".")}.`,
				);
		}
	}

	const removedClockRules: Array<{
		ownerItemUid: string;
		ruleNumber: number;
	}> = [];
	const removedUnitOutcomeOwnerIds: string[] = [];
	const removedExpiryOutcomeOwnerIds: string[] = [];
	const removedLines: Array<{
		ownerItemUid: string;
		lineUid: string;
		title: string;
	}> = [];
	const removedMergeRules: Array<{
		ownerItemUid: string;
		ruleNumber: number;
	}> = [];
	const items: Record<string, unknown> = {
		...config.items,
	};
	delete items[itemUid];

	for (const [ownerItemUid, cleanup] of itemCleanups) {
		const owner = config.items[ownerItemUid];
		if (owner === undefined) continue;
		const candidate: Record<string, unknown> = {
			...owner,
		};
		if (owner.clock !== undefined && cleanup.clockRuleIndexes.size > 0)
			candidate.clock = {
				...owner.clock,
				rules: owner.clock.rules.filter(
					(_rule, index) => !cleanup.clockRuleIndexes.has(index),
				),
			};
		for (const index of cleanup.clockRuleIndexes)
			removedClockRules.push({
				ownerItemUid,
				ruleNumber: index + 1,
			});

		if (cleanup.mergeIndexes.size > 0) {
			const merge = (owner.merge ?? []).filter(
				(_rule, index) => !cleanup.mergeIndexes.has(index),
			);
			candidate.merge = merge.length === 0 ? undefined : merge;
			for (const index of cleanup.mergeIndexes)
				removedMergeRules.push({
					ownerItemUid,
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
						ownerItemUid,
						lineUid: line.uid,
						title: line.title,
					});
			}
		}
		if (cleanup.removeUnitsOutcome && owner.units !== undefined) {
			candidate.units = {
				...owner.units,
				outcome: undefined,
			};
			removedUnitOutcomeOwnerIds.push(ownerItemUid);
		}
		if (cleanup.removeExpiryOutcome) {
			if (owner.clock !== undefined)
				candidate.clock = {
					...(candidate.clock as typeof owner.clock),
					onExpire: undefined,
				};
			removedExpiryOutcomeOwnerIds.push(ownerItemUid);
		}
		items[ownerItemUid] = candidate;
	}

	return {
		config: GameConfig.parse({
			...config,
			templates: config.templates?.map((template) => ({
				...template,
				board: template.board.filter((cell) => cell.itemUid !== itemUid),
			})),
			items,
		}),
		impact: {
			removedTemplateEntries: (config.templates ?? []).flatMap((template) => {
				const count = template.board.filter((cell) => cell.itemUid === itemUid).length;
				return count === 0
					? []
					: [
							{
								templateUid: template.uid,
								title: template.title,
								count,
							},
						];
			}),
			removedClockRules,
			removedUnitOutcomeOwnerIds,
			removedExpiryOutcomeOwnerIds,
			removedLines,
			removedMergeRules,
		},
	};
});
