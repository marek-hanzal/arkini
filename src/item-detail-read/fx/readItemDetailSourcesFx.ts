import { Effect, Option } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { lineRulesFx } from "~/production-line/fx/lineRulesFx";
import { resolveLineShowFn } from "~/production-line/fn/resolveLineShowFn";
import { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";
import { RuleTypeSchema as LineRuleTypeSchema } from "~/production-line/schema/RuleTypeSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import type { QuantitySchema } from "~/item-definition/schema/QuantitySchema";
import { RollTypeSchema } from "~/outcome/schema/RollTypeSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace readItemDetailSourcesFx {
	export interface Props {
		readonly target:
			| {
					readonly kind: "runtime";
					readonly itemId: IdSchema.Type;
			  }
			| {
					readonly kind: "definition";
					readonly itemUid: IdSchema.Type;
			  };
		readonly runtime: RuntimeSchema.Type;
	}

	export interface QuantityBounds {
		readonly min: number;
		readonly max: number;
	}

	export type OutcomeFact =
		| {
				readonly kind: "guaranteed";
				readonly quantity: QuantityBounds;
				readonly setWeight: number;
				readonly totalSetWeight: number;
		  }
		| {
				readonly kind: "chance";
				readonly chance: number;
				readonly quantity: QuantityBounds;
				readonly setWeight: number;
				readonly totalSetWeight: number;
		  };

	export interface Line {
		readonly lineId: IdSchema.Type;
		readonly title: string;
		readonly outcome: readonly OutcomeFact[];
	}

	export interface Source {
		readonly ownerItemId: IdSchema.Type;
		readonly ownerItemUid: IdSchema.Type;
		readonly space?: number;
		readonly line: readonly Line[];
	}

	export type Result =
		| {
				readonly kind: "available";
				readonly itemUid: IdSchema.Type;
				readonly targetItemUid: IdSchema.Type;
				readonly source: readonly Source[];
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies readItemDetailSourcesFx.Result;

const quantityBoundsFn = (quantity: QuantitySchema.Type): readItemDetailSourcesFx.QuantityBounds =>
	quantity;

const targetQuantityFn = ({
	outcome,
	targetItemUid,
}: {
	readonly outcome: readonly OutcomeSchema.Type[];
	readonly targetItemUid: IdSchema.Type;
}): readItemDetailSourcesFx.QuantityBounds | undefined => {
	let min = 0;
	let max = 0;
	let found = false;
	for (const candidate of outcome) {
		if (candidate.type !== "item" || candidate.itemUid !== targetItemUid) continue;
		const bounds = quantityBoundsFn(candidate.quantity);
		min += bounds.min;
		max += bounds.max;
		found = true;
	}
	return found
		? {
				min,
				max,
			}
		: undefined;
};

const readMatchingFactsFn = ({
	outcome,
	targetItemUid,
}: {
	readonly outcome: OutcomeTableSchema.Type | undefined;
	readonly targetItemUid: IdSchema.Type;
}): readonly readItemDetailSourcesFx.OutcomeFact[] => {
	if (outcome === undefined) return [];
	const totalSetWeight = outcome.set.reduce((total, set) => total + set.weight, 0);
	const facts: readItemDetailSourcesFx.OutcomeFact[] = [];

	for (const set of outcome.set) {
		const setWeight = set.weight;
		for (const roll of set.roll) {
			match(roll)
				.with(
					{
						type: RollTypeSchema.enum.Guaranteed,
					},
					({ outcome }) => {
						const quantity = targetQuantityFn({
							outcome,
							targetItemUid,
						});
						if (quantity === undefined) return;
						facts.push({
							kind: "guaranteed",
							quantity,
							setWeight,
							totalSetWeight,
						});
					},
				)
				.with(
					{
						type: RollTypeSchema.enum.Chance,
					},
					({ chance, outcome }) => {
						const quantity = targetQuantityFn({
							outcome,
							targetItemUid,
						});
						if (quantity === undefined) return;
						facts.push({
							kind: "chance",
							chance,
							quantity,
							setWeight,
							totalSetWeight,
						});
					},
				)
				.exhaustive();
		}
	}

	return facts;
};

interface OrderedSource extends readItemDetailSourcesFx.Source {
	readonly ownerTitle: string;
}

const readOwnedSourcesFx = Effect.fn("readOwnedItemDetailSourcesFx")(function* ({
	runtime,
	targetItemUid,
}: {
	readonly runtime: RuntimeSchema.Type;
	readonly targetItemUid: IdSchema.Type;
}) {
	const activeLine = new Set(runtime.jobs.map((job) => `${job.ownerItemId}\u0000${job.lineId}`));
	const source: OrderedSource[] = [];
	for (const owner of runtime.items) {
		const ownerItem = Option.getOrUndefined(narrowLineOwnerItemFn(owner.item));
		if (ownerItem === undefined) continue;
		const boardLocation =
			owner.location.scope === LocationScopeEnumSchema.enum.Board
				? owner.location
				: undefined;
		const lines = ownerItem.lines;
		const matchingLines: readItemDetailSourcesFx.Line[] = [];
		for (const line of lines) {
			const outcome = readMatchingFactsFn({
				outcome: line.outcome,
				targetItemUid,
			});
			if (outcome.length === 0) continue;
			if (boardLocation !== undefined) {
				const visibilityRules = line.rules.filter(
					(rule) =>
						rule.type === LineRuleTypeSchema.enum.Show ||
						rule.type === LineRuleTypeSchema.enum.Hide,
				);
				let visible = line.show;
				if (visibilityRules.length > 0) {
					const rules = yield* lineRulesFx({
						origin: boardLocation,
						rules: visibilityRules,
					}).pipe(
						Effect.provideService(RuntimeFx, {
							read: Effect.succeed(runtime),
						}),
					);
					visible = resolveLineShowFn({
						line,
						rules,
					});
				}
				visible ||= activeLine.has(`${owner.id}\u0000${line.id}`);
				if (!visible) continue;
			}
			matchingLines.push({
				lineId: line.id,
				title: line.title,
				outcome,
			});
		}
		if (matchingLines.length === 0) continue;
		source.push({
			ownerItemId: owner.id,
			ownerItemUid: owner.item.uid,
			ownerTitle: owner.item.title,
			...(boardLocation === undefined
				? {}
				: {
						space: boardLocation.space,
					}),
			line: matchingLines,
		});
	}

	source.sort((left, right) => {
		const leftOnBoard = left.space !== undefined;
		const rightOnBoard = right.space !== undefined;
		if (leftOnBoard !== rightOnBoard) return leftOnBoard ? -1 : 1;
		if (!leftOnBoard || !rightOnBoard) {
			const titleOrder = left.ownerTitle.localeCompare(right.ownerTitle);
			if (titleOrder !== 0) return titleOrder;
			const definitionOrder = left.ownerItemUid.localeCompare(right.ownerItemUid);
			return definitionOrder === 0
				? left.ownerItemId.localeCompare(right.ownerItemId)
				: definitionOrder;
		}
		const leftCurrent = left.space === runtime.currentSpace;
		const rightCurrent = right.space === runtime.currentSpace;
		if (leftCurrent !== rightCurrent) return leftCurrent ? -1 : 1;
		if (left.space !== right.space) return left.space - right.space;
		const titleOrder = left.ownerTitle.localeCompare(right.ownerTitle);
		return titleOrder === 0 ? left.ownerItemId.localeCompare(right.ownerItemId) : titleOrder;
	});
	return source;
});

/** Finds owned direct sources, resolving one unowned acquisition item hop when necessary. */
export const readItemDetailSourcesFx = Effect.fn("readItemDetailSourcesFx")(function* ({
	runtime,
	target,
}: readItemDetailSourcesFx.Props) {
	const targetItem =
		target.kind === "runtime"
			? runtime.items.find((candidate) => candidate.id === target.itemId)
			: undefined;
	if (target.kind === "runtime" && targetItem === undefined) return unavailable;
	const config = yield* GameConfigFx;
	let targetItemUid =
		target.kind === "runtime" ? targetItem?.item.uid : config.items[target.itemUid]?.uid;
	if (targetItemUid === undefined) return unavailable;
	const requestedItemUid = targetItemUid;

	let source = yield* readOwnedSourcesFx({
		runtime,
		targetItemUid,
	});
	if (source.length === 0) {
		for (const candidate of Object.values(config.items)) {
			const owner = Option.getOrUndefined(narrowLineOwnerItemFn(candidate));
			if (owner === undefined || owner.uid === targetItemUid) continue;
			const lines = owner.lines;
			if (
				!lines.some(
					(line) =>
						readMatchingFactsFn({
							outcome: line.outcome,
							targetItemUid: requestedItemUid,
						}).length > 0,
				)
			) {
				continue;
			}
			const acquiredFrom = yield* readOwnedSourcesFx({
				runtime,
				targetItemUid: owner.uid,
			});
			if (acquiredFrom.length === 0) continue;
			targetItemUid = owner.uid;
			source = acquiredFrom;
			break;
		}
	}

	return {
		kind: "available",
		itemUid: requestedItemUid,
		targetItemUid,
		source: source.map(({ ownerTitle: _, ...ordered }) => ordered),
	} satisfies readItemDetailSourcesFx.Result;
});
