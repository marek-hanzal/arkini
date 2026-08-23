import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

export type EditorProjectCompatibilityLevel = "none" | "minor" | "major";

export interface EditorProjectCompatibilityReason {
	readonly code: string;
	readonly message: string;
	readonly path: ReadonlyArray<string | number>;
}

export interface EditorProjectCompatibility {
	readonly level: EditorProjectCompatibilityLevel;
	readonly reasons: ReadonlyArray<EditorProjectCompatibilityReason>;
}

const changed = (left: unknown, right: unknown) => JSON.stringify(left) !== JSON.stringify(right);

const reason = (
	code: string,
	message: string,
	path: ReadonlyArray<string | number>,
): EditorProjectCompatibilityReason => ({
	code,
	message,
	path,
});

const readLines = (item: ItemSchema.Type): ReadonlyArray<LineSchema.Type> => {
	if ("lines" in item) return item.lines ?? [];
	if ("line" in item)
		return [
			item.line,
		];
	return [];
};

const invalidatesPersistedInput = (
	previous: LineSchema.Type["input"][number],
	next: LineSchema.Type["input"][number] | undefined,
) => {
	if (next === undefined || previous.type !== next.type) return true;
	if (previous.type !== "materials" || next.type !== "materials") return false;

	const previousMaxStoredQuantity = previous.quantity.max + previous.capacity;
	const nextMaxStoredQuantity = next.quantity.max + next.capacity;
	return (
		changed(previous.selector, next.selector) ||
		next.quantity.max < previous.quantity.max ||
		(previous.capacity > 0 && next.capacity === 0) ||
		nextMaxStoredQuantity < previousMaxStoredQuantity
	);
};

const findBreakingLineReasons = (previous: ItemSchema.Type, next: ItemSchema.Type) => {
	const nextLinesById = new Map(
		readLines(next).map((line) => [
			line.id,
			line,
		]),
	);
	return readLines(previous).flatMap((line) => {
		const nextLine = nextLinesById.get(line.id);
		if (nextLine === undefined)
			return [
				reason("line-removed", `Line ${line.id} was removed from item ${previous.id}.`, [
					"items",
					previous.id,
					"lines",
					line.id,
				]),
			];
		const reasons: EditorProjectCompatibilityReason[] = [];
		if (changed(line.output, nextLine.output))
			reasons.push(
				reason(
					"line-output-changed",
					`Line ${line.id} on item ${previous.id} changed output reserved by active jobs.`,
					[
						"items",
						previous.id,
						"lines",
						line.id,
						"output",
					],
				),
			);
		if (
			line.input.some((input, index) =>
				invalidatesPersistedInput(input, nextLine.input[index]),
			)
		)
			reasons.push(
				reason(
					"line-input-invalidated",
					`Line ${line.id} on item ${previous.id} invalidated an input that may already contain persisted material.`,
					[
						"items",
						previous.id,
						"lines",
						line.id,
						"input",
					],
				),
			);
		return reasons;
	});
};

const decreased = (previous: number | undefined, next: number | undefined) =>
	previous === undefined ? next !== undefined : next !== undefined && next < previous;

export namespace EditorProjectCompatibility {
	/** Pure compatibility classification shared by persistence and Effect/UI adapters. */
	export const analyze = (
		previous: GameConfigSchema.Type,
		next: GameConfigSchema.Type,
	): EditorProjectCompatibility => {
		if (!changed(previous, next))
			return {
				level: "none",
				reasons: [],
			};

		const breaking: EditorProjectCompatibilityReason[] = [];
		const dimensions = [
			[
				"board",
				"width",
				previous.meta.board.width,
				next.meta.board.width,
			],
			[
				"board",
				"height",
				previous.meta.board.height,
				next.meta.board.height,
			],
			[
				"inventory",
				"width",
				previous.meta.inventory.width,
				next.meta.inventory.width,
			],
			[
				"inventory",
				"height",
				previous.meta.inventory.height,
				next.meta.inventory.height,
			],
			[
				"toolbar",
				"size",
				previous.meta.toolbarSize,
				next.meta.toolbarSize,
			],
		] as const;
		for (const [surface, field, before, after] of dimensions) {
			if ((after ?? 0) < (before ?? 0))
				breaking.push(
					reason(
						"storage-shrunk",
						`${surface} ${field} shrank from ${before} to ${after}.`,
						[
							"meta",
							surface,
							field,
						],
					),
				);
		}

		for (const [itemId, previousItem] of Object.entries(previous.items)) {
			const nextItem = next.items[itemId];
			if (nextItem === undefined) {
				breaking.push(
					reason("item-removed", `Item ${itemId} was removed.`, [
						"items",
						itemId,
					]),
				);
				continue;
			}
			for (const [code, field, message] of [
				[
					"item-identity-changed",
					"uid",
					`Item ${itemId} changed its immutable identity.`,
				],
				[
					"item-id-changed",
					"id",
					`Item ${itemId} changed its persisted ID.`,
				],
			] as const) {
				if (previousItem[field] !== nextItem[field])
					breaking.push(
						reason(code, message, [
							"items",
							itemId,
							field,
						]),
					);
			}
			if (previousItem.type !== nextItem.type)
				breaking.push(
					reason(
						"item-type-changed",
						`Item ${itemId} changed type from ${previousItem.type} to ${nextItem.type}.`,
						[
							"items",
							itemId,
							"type",
						],
					),
				);
			if (previousItem.scope !== nextItem.scope)
				breaking.push(
					reason("item-scope-changed", `Item ${itemId} changed storage scope.`, [
						"items",
						itemId,
						"scope",
					]),
				);
			for (const [field, before, after] of [
				[
					"maxStackSize",
					previousItem.maxStackSize,
					nextItem.maxStackSize,
				],
				[
					"maxCount",
					previousItem.maxCount,
					nextItem.maxCount,
				],
				[
					"maxQueueSize",
					"maxQueueSize" in previousItem ? previousItem.maxQueueSize : undefined,
					"maxQueueSize" in nextItem ? nextItem.maxQueueSize : undefined,
				],
			] as const) {
				if (decreased(before, after))
					breaking.push(
						reason(
							"item-capacity-reduced",
							`Item ${itemId} ${field} can no longer contain every previously valid save.`,
							[
								"items",
								itemId,
								field,
							],
						),
					);
			}
			const previousCharges = previousItem.charges?.amount;
			const nextCharges = nextItem.charges?.amount;
			if (changed(previousItem.charges?.output, nextItem.charges?.output))
				breaking.push(
					reason(
						"item-charge-output-changed",
						`Item ${itemId} changed depletion output reserved by an active job.`,
						[
							"items",
							itemId,
							"charges",
							"output",
						],
					),
				);
			if (
				previousCharges !== undefined &&
				(nextCharges === undefined || nextCharges < previousCharges)
			)
				breaking.push(
					reason(
						"item-charges-reduced",
						`Item ${itemId} no longer accepts every persisted charge value.`,
						[
							"items",
							itemId,
							"charges",
						],
					),
				);
			if (
				"durationMs" in previousItem &&
				"durationMs" in nextItem &&
				nextItem.durationMs < previousItem.durationMs
			)
				breaking.push(
					reason(
						"temporary-duration-reduced",
						`Item ${itemId} duration can no longer contain every persisted remaining lifetime.`,
						[
							"items",
							itemId,
							"durationMs",
						],
					),
				);
			breaking.push(...findBreakingLineReasons(previousItem, nextItem));
		}

		return breaking.length > 0
			? {
					level: "major",
					reasons: breaking,
				}
			: {
					level: "minor",
					reasons: [
						reason(
							"save-compatible-change",
							"The change preserves every persisted gameplay identity and capacity.",
							[],
						),
					],
				};
	};

	export const bumpVersion = (
		version: ArkpackVersionSchema.Type,
		level: EditorProjectCompatibilityLevel,
	) => {
		const [major, minor] = ArkpackVersionSchema.parse(version).split(".").map(Number) as [
			number,
			number,
		];
		return ArkpackVersionSchema.parse(
			level === "major"
				? `${major + 1}.0`
				: level === "minor"
					? `${major}.${minor + 1}`
					: version,
		);
	};
}
