import { match } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { DistanceEnumSchema } from "~/engine/distance/schema/DistanceEnumSchema";
import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";
import type { RuleSchema } from "~/engine/line/schema/rule/RuleSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

export namespace readTileEffects {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface MatchedItem {
		readonly itemId: IdSchema.Type;
		readonly title: string;
		readonly quantity: number;
	}

	export interface EffectCondition {
		readonly relationId: string;
		readonly ownerItemId: IdSchema.Type;
		readonly ownerTitle: string;
		readonly lineId: IdSchema.Type;
		readonly lineTitle: string;
		readonly ruleType: RuleSchema.Type["type"];
		readonly multiplier?: number;
		readonly conditionType: WhenSchema.Type["type"];
		readonly queryScope: WhenSchema.Type["query"]["scope"];
		readonly queryDistance?: DistanceEnumSchema.Type;
		readonly selector: SelectorSchema.Type;
		readonly active: boolean;
		readonly matchedQuantity: number;
		readonly matchedItems: readonly MatchedItem[];
		readonly requiredCount?: number;
		readonly minimumCount?: number;
		readonly maximumCount?: number;
	}

	export type Result =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly incoming: readonly EffectCondition[];
				readonly outgoing: readonly EffectCondition[];
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies readTileEffects.Result;

const sameBoardPosition = (
	left: RuntimeItemSchema.Type,
	right: RuntimeItemSchema.Type,
	distance: DistanceEnumSchema.Type,
) => {
	if (left.location.scope !== "board" || right.location.scope !== "board") return false;
	if (left.location.space !== right.location.space) return false;
	const dx = Math.abs(left.location.position.x - right.location.position.x);
	const dy = Math.abs(left.location.position.y - right.location.position.y);
	const chebyshev = Math.max(dx, dy);
	return match(distance)
		.with("close", () => chebyshev === 1)
		.with("near", () => chebyshev === 2)
		.with("far", () => chebyshev > 0)
		.exhaustive();
};

const readOwnerLines = (
	item: Extract<
		RuntimeItemSchema.Type["item"],
		{
			readonly type: "blueprint" | "craft" | "producer" | "stash";
		}
	>,
) =>
	item.type === "producer"
		? item.lines
		: [
				item.line,
			];

const matchesSelector = (item: RuntimeItemSchema.Type, selector: SelectorSchema.Type) =>
	match(selector)
		.with(
			{
				type: "item",
			},
			({ itemId }) => item.item.id === itemId,
		)
		.with(
			{
				type: "tag",
			},
			({ tag }) => item.item.tags.includes(tag),
		)
		.exhaustive();

const queryItems = ({
	origin,
	query,
	runtime,
}: {
	readonly origin: RuntimeItemSchema.Type | undefined;
	readonly query: WhenSchema.Type["query"];
	readonly runtime: RuntimeSchema.Type;
}) => {
	const scoped = runtime.items.filter((item) => {
		return match(query)
			.with(
				{
					scope: "board",
				},
				({ distance }) => origin !== undefined && sameBoardPosition(origin, item, distance),
			)
			.with(
				{
					scope: "inventory",
				},
				() => item.location.scope === "inventory",
			)
			.with(
				{
					scope: "toolbar",
				},
				() => item.location.scope === "toolbar",
			)
			.with(
				{
					scope: "any",
				},
				() => {
					if (item.location.scope === "inventory" || item.location.scope === "toolbar") {
						return true;
					}
					if (item.location.scope !== "board") return false;
					return origin?.location.scope === "board"
						? item.location.space === origin.location.space
						: false;
				},
			)
			.with(
				{
					scope: "universe",
				},
				() =>
					item.location.scope === "board" ||
					item.location.scope === "inventory" ||
					item.location.scope === "toolbar",
			)
			.exhaustive();
	});
	return scoped.filter((item) => matchesSelector(item, query.selector));
};

const evaluateWhen = ({
	origin,
	owner,
	line,
	rule,
	runtime,
	when,
	whenIndex,
}: {
	readonly origin: RuntimeItemSchema.Type | undefined;
	readonly owner: RuntimeItemSchema.Type;
	readonly line: ReturnType<typeof readOwnerLines>[number];
	readonly rule: RuleSchema.Type;
	readonly runtime: RuntimeSchema.Type;
	readonly when: WhenSchema.Type;
	readonly whenIndex: number;
}): readTileEffects.EffectCondition => {
	const matchedItems = queryItems({
		origin,
		query: when.query,
		runtime,
	});
	const matchedQuantity = matchedItems.reduce((total, item) => total + item.quantity, 0);
	const active = match(when)
		.with(
			{
				type: "exists",
			},
			() => matchedQuantity > 0,
		)
		.with(
			{
				type: "count",
			},
			({ count }) => matchedQuantity === count,
		)
		.with(
			{
				type: "range",
			},
			({ min, max }) => matchedQuantity >= min && matchedQuantity <= max,
		)
		.exhaustive();
	return {
		relationId: `${owner.id}:${line.id}:${rule.type}:${whenIndex}`,
		ownerItemId: owner.id,
		ownerTitle: owner.item.title,
		lineId: line.id,
		lineTitle: line.title,
		ruleType: rule.type,
		...(rule.type !== "runtime:multiplier"
			? {}
			: {
					multiplier: rule.multiplier,
				}),
		conditionType: when.type,
		queryScope: when.query.scope,
		...(when.query.scope !== "board"
			? {}
			: {
					queryDistance: when.query.distance,
				}),
		selector: when.query.selector,
		active,
		matchedQuantity,
		matchedItems: matchedItems.map((item) => ({
			itemId: item.id,
			title: item.item.title,
			quantity: item.quantity,
		})),
		...(when.type !== "count"
			? {}
			: {
					requiredCount: when.count,
				}),
		...(when.type !== "range"
			? {}
			: {
					minimumCount: when.min,
					maximumCount: when.max,
				}),
	};
};

const readIncoming = (subject: RuntimeItemSchema.Type, runtime: RuntimeSchema.Type) => {
	if (!isLineOwnerItem(subject.item)) return [];
	const origin = subject.location.scope === "board" ? subject : undefined;
	return readOwnerLines(subject.item).flatMap((line) =>
		line.rules.flatMap((rule) =>
			rule.when.map((when, whenIndex) =>
				evaluateWhen({
					origin,
					owner: subject,
					line,
					rule,
					runtime,
					when,
					whenIndex,
				}),
			),
		),
	);
};

const readOutgoing = (subject: RuntimeItemSchema.Type, runtime: RuntimeSchema.Type) => {
	return runtime.items.flatMap((owner) => {
		if (!isLineOwnerItem(owner.item)) return [];
		const origin = owner.location.scope === "board" ? owner : undefined;
		return readOwnerLines(owner.item).flatMap((line) =>
			line.rules.flatMap((rule) =>
				rule.when.flatMap((when, whenIndex) => {
					const condition = evaluateWhen({
						origin,
						owner,
						line,
						rule,
						runtime,
						when,
						whenIndex,
					});
					return condition.matchedItems.some((item) => item.itemId === subject.id)
						? [
								condition,
							]
						: [];
				}),
			),
		);
	});
};

/** Projects one exact runtime tile's current incoming and outgoing effect conditions. */
export const readTileEffects = ({
	itemId,
	runtime,
}: readTileEffects.Props): readTileEffects.Result => {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined) return unavailable;
	return {
		kind: "available",
		itemId: item.id,
		incoming: readIncoming(item, runtime),
		outgoing: readOutgoing(item, runtime),
	};
};
