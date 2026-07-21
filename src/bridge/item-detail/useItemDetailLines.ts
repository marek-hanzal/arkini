import { useCallback } from "react";
import { match } from "ts-pattern";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readRuntimeItemPrimaryAssetId } from "~/engine/item/read/readRuntimeItemPrimaryAssetId";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
import type { InputChargeFromEnumSchema } from "~/engine/input/schema/InputChargeFromEnumSchema";
import type { InputModeEnumSchema } from "~/engine/input/schema/InputModeEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";
import { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";

export namespace useItemDetailLines {
	export interface QuantityBounds {
		readonly min: number;
		readonly max: number;
	}

	export interface ChargeCost {
		readonly cost: number;
		readonly from: InputChargeFromEnumSchema.Type;
	}

	export interface Selector {
		readonly kind: SelectorSchema.Type["type"];
		readonly label: string;
	}

	export type Input =
		| {
				readonly kind: "materials";
				readonly selector: Selector;
				readonly mode: InputModeEnumSchema.Type;
				readonly required: QuantityBounds;
				readonly storedQuantity: number;
				readonly maxStoredQuantity: number;
				readonly missingQuantity: number;
				readonly availableCapacity: number;
				readonly ready: boolean;
				readonly charges?: ChargeCost;
		  }
		| {
				readonly kind: "deposit";
				readonly selector: Selector;
				readonly distance: "close" | "near" | "far";
				readonly requiredTargets: number;
				readonly readyTargets: number;
				readonly targetTitles: readonly string[];
				readonly ready: boolean;
				readonly charges?: ChargeCost;
		  }
		| {
				readonly kind: "simple";
				readonly count: number;
				readonly ready: boolean;
				readonly charges: ChargeCost;
		  };

	export interface OutputItem {
		readonly itemId: string;
		readonly title: string;
		readonly quantity: QuantityBounds;
		readonly sourceUrl?: string;
		readonly compositeUrl?: string;
		readonly detailItemId?: string;
	}

	export type OutputRoll =
		| {
				readonly kind: "guaranteed";
				readonly item: readonly OutputItem[];
		  }
		| {
				readonly kind: "chance";
				readonly chance: number;
				readonly item: readonly OutputItem[];
		  }
		| {
				readonly kind: "weight";
				readonly selections: QuantityBounds;
				readonly option: readonly {
					readonly weight: number;
					readonly item: readonly OutputItem[];
				}[];
		  };

	export interface OutputSet {
		readonly weight: number;
		readonly roll: readonly OutputRoll[];
	}

	export type Availability = readItemDetailLinesFx.Availability;

	export interface Line {
		readonly lineId: string;
		readonly title: string;
		readonly description: string;
		readonly baseRuntimeMs: number;
		readonly effectiveRuntimeMs: number;
		readonly availability: Availability;
		readonly startMode: "start" | "enqueue";
		readonly isDefault: boolean;
		readonly actions: {
			readonly canAutofill: boolean;
			readonly canWithdraw: boolean;
		};
		readonly input: readonly Input[];
		readonly output: readonly OutputSet[];
		readonly activeJob?: {
			readonly status: "running" | "paused" | "awaiting-output";
			readonly durationMs: number;
			readonly remainingMs: number;
		};
	}

	export type Projection =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly line: readonly Line[];
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies useItemDetailLines.Projection;

const selectorLabel = (
	selector: SelectorSchema.Type,
	items: ReturnType<typeof useGameEngine>["config"]["items"],
): useItemDetailLines.Selector =>
	match(selector)
		.with(
			{
				type: "item",
			},
			({ itemId }) => ({
				kind: "item" as const,
				label: items[itemId]?.title ?? itemId,
			}),
		)
		.with(
			{
				type: "tag",
			},
			({ tag }) => ({
				kind: "tag" as const,
				label: tag,
			}),
		)
		.exhaustive();

const mapOutputItem = ({
	game,
	item,
	runtime,
}: {
	readonly game: ReturnType<typeof useGameEngine>;
	readonly item: readItemDetailLinesFx.OutputItem;
	readonly runtime: RuntimeSchema.Type;
}): useItemDetailLines.OutputItem => {
	const configured = game.config.items[item.itemId];
	const detailItemId = runtime.items.find(
		(candidate) => isGridRuntimeItem(candidate) && candidate.item.id === item.itemId,
	)?.id;
	return {
		itemId: item.itemId,
		title: configured?.title ?? item.itemId,
		quantity: item.quantity,
		...(configured === undefined
			? {}
			: {
					sourceUrl: game.getResourceUrl(
						readRuntimeItemPrimaryAssetId(runtime, configured),
					),
					...(configured.asset.composite === undefined
						? {}
						: {
								compositeUrl: game.getResourceUrl(configured.asset.composite),
							}),
				}),
		...(detailItemId === undefined
			? {}
			: {
					detailItemId,
				}),
	};
};

const mapOutputRoll = ({
	game,
	roll,
	runtime,
}: {
	readonly game: ReturnType<typeof useGameEngine>;
	readonly roll: readItemDetailLinesFx.OutputRoll;
	readonly runtime: RuntimeSchema.Type;
}): useItemDetailLines.OutputRoll =>
	match(roll)
		.with(
			{
				kind: "guaranteed",
			},
			({ item }) => ({
				kind: "guaranteed" as const,
				item: item.map((entry) =>
					mapOutputItem({
						game,
						item: entry,
						runtime,
					}),
				),
			}),
		)
		.with(
			{
				kind: "chance",
			},
			({ chance, item }) => ({
				kind: "chance" as const,
				chance,
				item: item.map((entry) =>
					mapOutputItem({
						game,
						item: entry,
						runtime,
					}),
				),
			}),
		)
		.with(
			{
				kind: "weight",
			},
			({ selections, option }) => ({
				kind: "weight" as const,
				selections,
				option: option.map((candidate) => ({
					weight: candidate.weight,
					item: candidate.item.map((entry) =>
						mapOutputItem({
							game,
							item: entry,
							runtime,
						}),
					),
				})),
			}),
		)
		.exhaustive();

const mapInput = ({
	input,
	items,
	runtime,
}: {
	readonly input: readItemDetailLinesFx.Input;
	readonly items: ReturnType<typeof useGameEngine>["config"]["items"];
	readonly runtime: RuntimeSchema.Type;
}): useItemDetailLines.Input =>
	match(input)
		.with(
			{
				kind: "materials",
			},
			(input) => ({
				...input,
				selector: selectorLabel(input.selector, items),
			}),
		)
		.with(
			{
				kind: "deposit",
			},
			(input) => ({
				kind: input.kind,
				selector: selectorLabel(input.selector, items),
				distance: input.distance,
				requiredTargets: input.requiredTargets,
				readyTargets: input.readyTargets,
				targetTitles: input.targetItemIds.map(
					(itemId) =>
						runtime.items.find((item) => item.id === itemId)?.item.title ?? itemId,
				),
				ready: input.ready,
				...(input.charges === undefined
					? {}
					: {
							charges: input.charges,
						}),
			}),
		)
		.with(
			{
				kind: "simple",
			},
			(input) => input,
		)
		.exhaustive();

const sameBounds = (
	left: useItemDetailLines.QuantityBounds,
	right: useItemDetailLines.QuantityBounds,
) => left.min === right.min && left.max === right.max;

const sameCharge = (
	left: useItemDetailLines.ChargeCost | undefined,
	right: useItemDetailLines.ChargeCost | undefined,
) => left?.cost === right?.cost && left?.from === right?.from;

const sameSelector = (left: useItemDetailLines.Selector, right: useItemDetailLines.Selector) =>
	left.kind === right.kind && left.label === right.label;

const sameStringArray = (left: readonly string[], right: readonly string[]) =>
	left.length === right.length && left.every((value, index) => value === right[index]);

const sameInput = (left: useItemDetailLines.Input, right: useItemDetailLines.Input) => {
	if (left.kind !== right.kind) return false;
	return match(left)
		.with(
			{
				kind: "materials",
			},
			(left) => {
				if (right.kind !== "materials") return false;
				return (
					sameSelector(left.selector, right.selector) &&
					left.mode === right.mode &&
					sameBounds(left.required, right.required) &&
					left.storedQuantity === right.storedQuantity &&
					left.maxStoredQuantity === right.maxStoredQuantity &&
					left.missingQuantity === right.missingQuantity &&
					left.availableCapacity === right.availableCapacity &&
					left.ready === right.ready &&
					sameCharge(left.charges, right.charges)
				);
			},
		)
		.with(
			{
				kind: "deposit",
			},
			(left) => {
				if (right.kind !== "deposit") return false;
				return (
					sameSelector(left.selector, right.selector) &&
					left.distance === right.distance &&
					left.requiredTargets === right.requiredTargets &&
					left.readyTargets === right.readyTargets &&
					sameStringArray(left.targetTitles, right.targetTitles) &&
					left.ready === right.ready &&
					sameCharge(left.charges, right.charges)
				);
			},
		)
		.with(
			{
				kind: "simple",
			},
			(left) => {
				if (right.kind !== "simple") return false;
				return (
					left.count === right.count &&
					left.ready === right.ready &&
					sameCharge(left.charges, right.charges)
				);
			},
		)
		.exhaustive();
};

const sameOutputItem = (
	left: useItemDetailLines.OutputItem,
	right: useItemDetailLines.OutputItem,
) =>
	left.itemId === right.itemId &&
	left.title === right.title &&
	left.sourceUrl === right.sourceUrl &&
	left.compositeUrl === right.compositeUrl &&
	left.detailItemId === right.detailItemId &&
	sameBounds(left.quantity, right.quantity);

const sameOutputItems = (
	left: readonly useItemDetailLines.OutputItem[],
	right: readonly useItemDetailLines.OutputItem[],
) =>
	left.length === right.length &&
	left.every((item, index) => right[index] !== undefined && sameOutputItem(item, right[index]));

const sameOutputRoll = (
	left: useItemDetailLines.OutputRoll,
	right: useItemDetailLines.OutputRoll,
) => {
	if (left.kind !== right.kind) return false;
	return match(left)
		.with(
			{
				kind: "guaranteed",
			},
			(left) => right.kind === "guaranteed" && sameOutputItems(left.item, right.item),
		)
		.with(
			{
				kind: "chance",
			},
			(left) =>
				right.kind === "chance" &&
				left.chance === right.chance &&
				sameOutputItems(left.item, right.item),
		)
		.with(
			{
				kind: "weight",
			},
			(left) =>
				right.kind === "weight" &&
				sameBounds(left.selections, right.selections) &&
				left.option.length === right.option.length &&
				left.option.every((option, index) => {
					const candidate = right.option[index];
					return (
						candidate !== undefined &&
						option.weight === candidate.weight &&
						sameOutputItems(option.item, candidate.item)
					);
				}),
		)
		.exhaustive();
};

const sameAvailability = (
	left: useItemDetailLines.Availability,
	right: useItemDetailLines.Availability,
) =>
	left.kind === right.kind &&
	(left.kind !== "blocked" || right.kind !== "blocked" || left.reason === right.reason);

const sameLine = (left: useItemDetailLines.Line, right: useItemDetailLines.Line) =>
	left.lineId === right.lineId &&
	left.title === right.title &&
	left.description === right.description &&
	left.baseRuntimeMs === right.baseRuntimeMs &&
	left.effectiveRuntimeMs === right.effectiveRuntimeMs &&
	left.startMode === right.startMode &&
	left.isDefault === right.isDefault &&
	sameAvailability(left.availability, right.availability) &&
	left.input.length === right.input.length &&
	left.input.every(
		(input, index) => right.input[index] !== undefined && sameInput(input, right.input[index]),
	) &&
	left.output.length === right.output.length &&
	left.output.every((set, index) => {
		const candidate = right.output[index];
		return (
			candidate !== undefined &&
			set.weight === candidate.weight &&
			set.roll.length === candidate.roll.length &&
			set.roll.every(
				(roll, rollIndex) =>
					candidate.roll[rollIndex] !== undefined &&
					sameOutputRoll(roll, candidate.roll[rollIndex]),
			)
		);
	}) &&
	left.activeJob?.status === right.activeJob?.status &&
	left.activeJob?.durationMs === right.activeJob?.durationMs &&
	left.activeJob?.remainingMs === right.activeJob?.remainingMs;

const sameProjection = (
	left: useItemDetailLines.Projection,
	right: useItemDetailLines.Projection,
) => {
	if (left.kind !== right.kind) return false;
	if (left.kind === "unavailable" || right.kind === "unavailable") return true;
	return (
		left.itemId === right.itemId &&
		left.line.length === right.line.length &&
		left.line.every(
			(line, index) => right.line[index] !== undefined && sameLine(line, right.line[index]),
		)
	);
};

/** Projects the current visible product lines and authoritative action readiness of one exact line owner. */
export const useItemDetailLines = (itemId: IdSchema.Type): useItemDetailLines.Projection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailLines.Projection => {
			const lines = game.readOrThrow(
				readItemDetailLinesFx({
					itemId,
					runtime,
				}),
			);
			if (lines.kind === "unavailable") return unavailable;
			return {
				kind: "available",
				itemId: lines.itemId,
				line: lines.line.map((line) => ({
					...line,
					input: line.input.map((input) =>
						mapInput({
							input,
							items: game.config.items,
							runtime,
						}),
					),
					output: line.output.map((set) => ({
						weight: set.weight,
						roll: set.roll.map((roll) =>
							mapOutputRoll({
								game,
								roll,
								runtime,
							}),
						),
					})),
				})),
			};
		},
		[
			game,
			itemId,
		],
	);
	return useRuntimeSelector(selector, sameProjection);
};
