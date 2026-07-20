import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { TimeSchema } from "~/engine/common/schema/TimeSchema";
import type { InputChargeFromEnumSchema } from "~/engine/input/schema/InputChargeFromEnumSchema";
import type { InputModeEnumSchema } from "~/engine/input/schema/InputModeEnumSchema";
import type { InputRunResolutionSchema } from "~/engine/input/schema/run/InputRunResolutionSchema";
import type { InputSchema } from "~/engine/input/schema/InputSchema";
import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";
import { readLineOwnerLines } from "~/engine/line/read/readLineOwnerLines";
import { resolveLineStartFx } from "~/engine/job/fx/read/resolveLineStartFx";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import type { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";
import type { RollSchema } from "~/engine/roll/schema/RollSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";

export namespace readTileLinesFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface QuantityBounds {
		readonly min: number;
		readonly max: number;
	}

	export interface ChargeCost {
		readonly cost: number;
		readonly from: InputChargeFromEnumSchema.Type;
	}

	export interface MaterialInput {
		readonly kind: "materials";
		readonly selector: SelectorSchema.Type;
		readonly mode: InputModeEnumSchema.Type;
		readonly required: QuantityBounds;
		readonly storedQuantity: number;
		readonly maxStoredQuantity: number;
		readonly missingQuantity: number;
		readonly availableCapacity: number;
		readonly ready: boolean;
		readonly charges?: ChargeCost;
	}

	export interface DepositInput {
		readonly kind: "deposit";
		readonly selector: SelectorSchema.Type;
		readonly distance: "close" | "near" | "far";
		readonly requiredTargets: number;
		readonly readyTargets: number;
		readonly targetItemIds: readonly IdSchema.Type[];
		readonly ready: boolean;
		readonly charges?: ChargeCost;
	}

	export interface SimpleInput {
		readonly kind: "simple";
		readonly count: number;
		readonly ready: boolean;
		readonly charges: ChargeCost;
	}

	export type Input = MaterialInput | DepositInput | SimpleInput;

	export interface OutputItem {
		readonly itemId: IdSchema.Type;
		readonly quantity: QuantityBounds;
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

	export type Availability =
		| {
				readonly kind: "ready";
		  }
		| {
				readonly kind: "blocked";
				readonly reason: "disabled" | "inputs" | "queue" | "stored";
		  };

	export interface Line {
		readonly lineId: IdSchema.Type;
		readonly title: string;
		readonly description: string;
		readonly baseRuntimeMs: TimeSchema.Type;
		readonly effectiveRuntimeMs: TimeSchema.Type;
		readonly availability: Availability;
		readonly input: readonly Input[];
		readonly output: readonly OutputSet[];
		readonly activeJob?: {
			readonly durationMs: TimeSchema.Type;
			readonly remainingMs: TimeSchema.Type;
		};
	}

	export type Result =
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
} as const satisfies readTileLinesFx.Result;

const quantityBounds = (quantity: QuantitySchema.Type): readTileLinesFx.QuantityBounds =>
	match(quantity)
		.with(
			{
				type: "value",
			},
			({ value }) => ({
				min: value,
				max: value,
			}),
		)
		.with(
			{
				type: "range",
			},
			({ min, max }) => ({
				min,
				max,
			}),
		)
		.exhaustive();

const selectorKey = (selector: SelectorSchema.Type) =>
	match(selector)
		.with(
			{
				type: "item",
			},
			({ itemId }) => `item:${itemId}`,
		)
		.with(
			{
				type: "tag",
			},
			({ tag }) => `tag:${tag}`,
		)
		.exhaustive();

const chargeKey = (charges: InputSchema.Type["charges"]) =>
	charges === undefined ? "none" : `${charges.from}:${charges.cost}`;

const inputItems = ({
	inputIndex,
	lineId,
	ownerItemId,
	runtime,
}: {
	readonly inputIndex: number;
	readonly lineId: IdSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) =>
	runtime.items.filter(
		(item) =>
			item.location.scope === "input" &&
			item.location.ownerItemId === ownerItemId &&
			item.location.lineId === lineId &&
			item.location.inputIndex === inputIndex,
	);

const readInputs = ({
	configured,
	lineId,
	ownerItemId,
	resolved,
	runtime,
}: {
	readonly configured: readonly InputSchema.Type[];
	readonly lineId: IdSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly resolved?: readonly InputRunResolutionSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}): readonly readTileLinesFx.Input[] => {
	const materials = new Map<string, readTileLinesFx.MaterialInput>();
	const deposits = new Map<string, readTileLinesFx.DepositInput>();
	const simple = new Map<string, readTileLinesFx.SimpleInput>();

	for (const [inputIndex, input] of configured.entries()) {
		const resolution = resolved?.[inputIndex]?.resolution;
		match(input)
			.with(
				{
					type: "materials",
				},
				(input) => {
					const required = quantityBounds(input.quantity);
					const storedQuantity =
						resolution?.type === "materials"
							? resolution.storedQuantity
							: inputItems({
									inputIndex,
									lineId,
									ownerItemId,
									runtime,
								}).reduce((total, item) => total + item.quantity, 0);
					const maxStoredQuantity =
						resolution?.type === "materials"
							? resolution.maxStoredQuantity
							: required.max + input.capacity;
					const missingQuantity = Math.max(0, required.min - storedQuantity);
					const availableCapacity = Math.max(0, maxStoredQuantity - storedQuantity);
					const key = `${selectorKey(input.selector)}:${input.mode}:${chargeKey(input.charges)}`;
					const previous = materials.get(key);
					materials.set(key, {
						kind: "materials",
						selector: input.selector,
						mode: input.mode,
						required: {
							min: (previous?.required.min ?? 0) + required.min,
							max: (previous?.required.max ?? 0) + required.max,
						},
						storedQuantity: (previous?.storedQuantity ?? 0) + storedQuantity,
						maxStoredQuantity: (previous?.maxStoredQuantity ?? 0) + maxStoredQuantity,
						missingQuantity: (previous?.missingQuantity ?? 0) + missingQuantity,
						availableCapacity: (previous?.availableCapacity ?? 0) + availableCapacity,
						ready:
							(previous?.ready ?? true) &&
							(resolution?.ready ?? storedQuantity >= required.min),
						...(input.charges === undefined
							? {}
							: {
									charges: input.charges,
								}),
					});
				},
			)
			.with(
				{
					type: "deposit",
				},
				(input) => {
					const key = `${selectorKey(input.query.selector)}:${input.query.distance}:${chargeKey(input.charges)}`;
					const previous = deposits.get(key);
					const targetItemId =
						resolution?.type === "deposit" ? resolution.targetItemId : undefined;
					deposits.set(key, {
						kind: "deposit",
						selector: input.query.selector,
						distance: input.query.distance,
						requiredTargets: (previous?.requiredTargets ?? 0) + 1,
						readyTargets: (previous?.readyTargets ?? 0) + (resolution?.ready ? 1 : 0),
						targetItemIds:
							targetItemId === undefined
								? (previous?.targetItemIds ?? [])
								: [
										...(previous?.targetItemIds ?? []),
										targetItemId,
									],
						ready: (previous?.ready ?? true) && (resolution?.ready ?? false),
						...(input.charges === undefined
							? {}
							: {
									charges: input.charges,
								}),
					});
				},
			)
			.with(
				{
					type: "simple",
				},
				(input) => {
					if (input.charges === undefined) return;
					const key = chargeKey(input.charges);
					const previous = simple.get(key);
					simple.set(key, {
						kind: "simple",
						count: (previous?.count ?? 0) + 1,
						ready: (previous?.ready ?? true) && (resolution?.ready ?? false),
						charges: input.charges,
					});
				},
			)
			.exhaustive();
	}

	return [
		...materials.values(),
		...deposits.values(),
		...simple.values(),
	];
};

const groupDrops = (drops: readonly DropSchema.Type[]): readonly readTileLinesFx.OutputItem[] => {
	const grouped = new Map<IdSchema.Type, readTileLinesFx.OutputItem>();
	for (const drop of drops) {
		const bounds = quantityBounds(drop.quantity);
		const previous = grouped.get(drop.itemId);
		grouped.set(drop.itemId, {
			itemId: drop.itemId,
			quantity: {
				min: (previous?.quantity.min ?? 0) + bounds.min,
				max: (previous?.quantity.max ?? 0) + bounds.max,
			},
		});
	}
	return [
		...grouped.values(),
	];
};

const readRoll = (roll: RollSchema.Type): readTileLinesFx.OutputRoll =>
	match(roll)
		.with(
			{
				type: "guaranteed",
			},
			({ drop }) => ({
				kind: "guaranteed" as const,
				item: groupDrops(drop),
			}),
		)
		.with(
			{
				type: "chance",
			},
			({ chance, drop }) => ({
				kind: "chance" as const,
				chance,
				item: groupDrops(drop),
			}),
		)
		.with(
			{
				type: "weight",
			},
			({ quantity, drop }) => ({
				kind: "weight" as const,
				selections: quantityBounds(quantity),
				option: drop.map((candidate) => ({
					weight: candidate.weight,
					item: groupDrops(candidate.drop),
				})),
			}),
		)
		.exhaustive();

const readOutput = (line: LineSchema.Type): readonly readTileLinesFx.OutputSet[] =>
	line.output?.set.map((set) => ({
		weight: set.weight ?? 1,
		roll: set.roll.map(readRoll),
	})) ?? [];

const storedLine = ({
	activeJob,
	line,
	ownerItemId,
	runtime,
}: {
	readonly activeJob: RuntimeSchema.Type["jobs"][number] | undefined;
	readonly line: LineSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}): readTileLinesFx.Line => ({
	lineId: line.id,
	title: line.title,
	description: line.description,
	baseRuntimeMs: line.runtimeMs,
	effectiveRuntimeMs: line.runtimeMs,
	availability: {
		kind: "blocked",
		reason: "stored",
	},
	input: readInputs({
		configured: line.input,
		lineId: line.id,
		ownerItemId,
		runtime,
	}),
	output: readOutput(line),
	...(activeJob === undefined
		? {}
		: {
				activeJob: {
					durationMs: activeJob.durationMs,
					remainingMs: activeJob.remainingMs,
				},
			}),
});

/** Projects the visible read-only product lines of one exact live line owner. */
export const readTileLinesFx = Effect.fn("readTileLinesFx")(function* ({
	itemId,
	runtime,
}: readTileLinesFx.Props) {
	const owner = runtime.items.find((candidate) => candidate.id === itemId);
	if (owner === undefined || !isLineOwnerItem(owner.item)) return unavailable;
	const lines = readLineOwnerLines(owner.item);
	const projected: readTileLinesFx.Line[] = [];

	for (const line of lines) {
		const activeJob = runtime.jobs.find(
			(job) => job.ownerItemId === owner.id && job.lineId === line.id,
		);
		if (owner.location.scope !== "board") {
			if (line.show || activeJob !== undefined) {
				projected.push(
					storedLine({
						activeJob,
						line,
						ownerItemId: owner.id,
						runtime,
					}),
				);
			}
			continue;
		}

		const start = yield* resolveLineStartFx({
			lineId: line.id,
			ownerItemId: owner.id,
			runtime,
		});
		const resolution = start.run;
		if (!resolution.show && activeJob === undefined) continue;
		const allInputsReady = resolution.input.every((input) => input.resolution.ready);
		projected.push({
			lineId: line.id,
			title: line.title,
			description: line.description,
			baseRuntimeMs: line.runtimeMs,
			effectiveRuntimeMs: resolution.runtimeMs,
			availability: start.ready
				? {
						kind: "ready",
					}
				: {
						kind: "blocked",
						reason: !resolution.enable
							? "disabled"
							: !allInputsReady
								? "inputs"
								: "queue",
					},
			input: readInputs({
				configured: line.input,
				lineId: line.id,
				ownerItemId: owner.id,
				resolved: resolution.input,
				runtime,
			}),
			output: readOutput(line),
			...(activeJob === undefined
				? {}
				: {
						activeJob: {
							durationMs: activeJob.durationMs,
							remainingMs: activeJob.remainingMs,
						},
					}),
		});
	}

	return {
		kind: "available",
		itemId: owner.id,
		line: projected,
	} satisfies readTileLinesFx.Result;
});
