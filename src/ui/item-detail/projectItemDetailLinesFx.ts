import { Effect } from "effect";

import type { GameEngine } from "~/renderer/game/GameEngine";
import type { ItemDetailLines } from "~/ui/item-detail/ItemDetailLines";
import { projectItemDetailInputFx } from "~/ui/item-detail/projectItemDetailInputFx";
import { projectItemDetailReferenceFx } from "~/ui/item-detail/projectItemDetailReferenceFx";
import { projectItemDetailSelectorFn } from "~/ui/item-detail/fn/projectItemDetailSelectorFn";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemDetailLines as EngineItemDetailLines } from "~/engine/item-detail/read/ItemDetailLines";
import { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";
import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { match } from "ts-pattern";
import { TypeSchema } from "~/engine/when/schema/TypeSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

export namespace projectItemDetailLinesFx {
	export interface Props {
		readonly game: GameEngine;
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Result = ItemDetailLines.Projection;
}

type ProjectedLineDisabledCause = Extract<
	ItemDetailLines.DisabledReason,
	{
		readonly kind: "line-disabled";
	}
>["cause"];

const projectOutputItemFn = ({
	game,
	item,
}: {
	readonly game: GameEngine;
	readonly item: readItemDetailLinesFx.OutputItem;
}) => {
	const configured = game.config.items[item.itemId];
	if (configured === undefined) {
		return {
			itemId: item.itemId,
			title: item.itemId,
			quantity: item.quantity,
			activeRuleHints: item.activeRuleHints,
		} satisfies ItemDetailLines.OutputItem;
	}
	const sourceAssetIds = configured.asset.default;
	return {
		itemId: item.itemId,
		title: configured.title,
		quantity: item.quantity,
		activeRuleHints: item.activeRuleHints,
		sourceUrl: game.getResourceUrl(sourceAssetIds[0]),
		...(sourceAssetIds[1] === undefined
			? {}
			: {
					compositeUrl: game.getResourceUrl(sourceAssetIds[1]),
				}),
		definitionItemId: configured.id,
	} satisfies ItemDetailLines.OutputItem;
};

const projectItemDetailOutputRollFn = ({
	game,
	roll,
}: {
	readonly game: GameEngine;
	readonly roll: readItemDetailLinesFx.OutputRoll;
}) =>
	match(roll)
		.with(
			{
				kind: "guaranteed",
			},
			(guaranteed) => ({
				kind: "guaranteed" as const,
				item: guaranteed.item.map((item) =>
					projectOutputItemFn({
						game,
						item,
					}),
				),
			}),
		)
		.with(
			{
				kind: "chance",
			},
			(chance) => ({
				kind: "chance" as const,
				chance: chance.chance,
				item: chance.item.map((item) =>
					projectOutputItemFn({
						game,
						item,
					}),
				),
			}),
		)
		.with(
			{
				kind: "weight",
			},
			(weight) => ({
				kind: "weight" as const,
				selections: weight.selections,
				option: weight.option.map((option) => ({
					weight: option.weight,
					item: option.item.map((item) =>
						projectOutputItemFn({
							game,
							item,
						}),
					),
				})),
			}),
		)
		.exhaustive();

const readQueryLocationLabel = (query: WhenSchema.Type["query"]) =>
	match(query)
		.with(
			{
				scope: "board",
			},
			({ distance }) => `Board · ${distance}`,
		)
		.with(
			{
				scope: "inventory",
			},
			() => "Inventory",
		)
		.with(
			{
				scope: "toolbar",
			},
			() => "Toolbar",
		)
		.with(
			{
				scope: "any",
			},
			() => "Board, inventory or toolbar",
		)
		.with(
			{
				scope: "universe",
			},
			() => "Anywhere",
		)
		.exhaustive();

const readMaxCountMessageAfterTitle = ({
	liveQuantity,
	maxCount,
}: {
	readonly liveQuantity: number;
	readonly maxCount: number;
}) =>
	liveQuantity >= maxCount
		? `limit reached (${liveQuantity}/${maxCount}).`
		: `would exceed limit (${liveQuantity}/${maxCount} currently).`;

const projectDisabledConditionFx = Effect.fn("projectDisabledConditionFx")(function* ({
	game,
	runtime,
	when,
}: {
	readonly game: GameEngine;
	readonly runtime: RuntimeSchema.Type;
	readonly when: WhenSchema.Type;
}) {
	const selector = projectItemDetailSelectorFn({
		game,
		selector: when.query.selector,
	});
	const locationLabel = readQueryLocationLabel(when.query);
	const detail = yield* projectItemDetailReferenceFx({
		game,
		itemId: when.query.selector.itemId,
		runtime,
	});
	return match(when)
		.with(
			{
				type: TypeSchema.enum.Exists,
			},
			() => ({
				condition: {
					kind: "exists",
					locationLabel,
					selector,
					...(detail === undefined
						? {}
						: {
								detail,
							}),
				} satisfies ItemDetailLines.DisabledCondition,
				phrase: selector.label,
			}),
		)
		.with(
			{
				type: TypeSchema.enum.Count,
			},
			({ count }) => ({
				condition: {
					kind: "count",
					locationLabel,
					selector,
					count,
					...(detail === undefined
						? {}
						: {
								detail,
							}),
				} satisfies ItemDetailLines.DisabledCondition,
				phrase: `${count} ${selector.label}`,
			}),
		)
		.with(
			{
				type: TypeSchema.enum.Range,
			},
			({ max, min }) => ({
				condition: {
					kind: "range",
					locationLabel,
					selector,
					min,
					max,
					...(detail === undefined
						? {}
						: {
								detail,
							}),
				} satisfies ItemDetailLines.DisabledCondition,
				phrase: `${min}-${max} ${selector.label}`,
			}),
		)
		.exhaustive();
});

const projectAvailabilityFx = Effect.fn("projectItemDetailLineAvailabilityFx")(function* ({
	availability,
	game,
	runtime,
}: {
	readonly availability: EngineItemDetailLines.Availability;
	readonly game: GameEngine;
	readonly runtime: RuntimeSchema.Type;
}) {
	return yield* match(availability)
		.with(
			{
				kind: "available",
			},
			(available) =>
				Effect.succeed({
					kind: "available",
					readiness: available.readiness,
				} as const),
		)
		.with(
			{
				kind: "unavailable",
				reason: {
					kind: "line-disabled",
				},
			},
			({ reason }) =>
				Effect.gen(function* () {
					let cause: ProjectedLineDisabledCause;
					if (reason.cause.kind === "static") {
						cause = reason.cause;
					} else if (reason.cause.kind === "enable-rule") {
						const projected = yield* projectDisabledConditionFx({
							game,
							runtime,
							when: reason.cause.when,
						});
						cause = {
							kind: reason.cause.kind,
							hint: reason.cause.hint,
							ruleIndex: reason.cause.ruleIndex,
							whenIndex: reason.cause.whenIndex,
							condition: projected.condition,
						};
					} else {
						const projected = yield* Effect.all(
							reason.cause.when.map((when) =>
								projectDisabledConditionFx({
									game,
									runtime,
									when,
								}),
							),
						);
						cause = {
							kind: reason.cause.kind,
							hint: reason.cause.hint,
							ruleIndex: reason.cause.ruleIndex,
							condition: projected.map(({ condition }) => condition),
						};
					}
					const message =
						cause.kind === "static" ? "This line is currently disabled." : cause.hint;
					return {
						kind: "unavailable",
						reason: {
							kind: "line-disabled",
							cause,
							message,
						},
					} as const;
				}),
		)
		.with(
			{
				kind: "unavailable",
				reason: {
					kind: "deposit-target-missing",
				},
			},
			({ reason }) =>
				Effect.gen(function* () {
					const selector = projectItemDetailSelectorFn({
						game,
						selector: reason.selector,
					});
					const detail = yield* projectItemDetailReferenceFx({
						game,
						itemId: reason.selector.itemId,
						runtime,
					});
					const messageBeforeDetail = "Requires ";
					const messageAfterDetail = ` · None available (Board · ${reason.distance}).`;
					return {
						kind: "unavailable",
						reason: {
							kind: reason.kind,
							selector,
							distance: reason.distance,
							...(detail === undefined
								? {}
								: {
										detail,
										messageBeforeDetail,
										messageAfterDetail,
									}),
							message: `${messageBeforeDetail}${selector.label}${messageAfterDetail}`,
						},
					} as const;
				}),
		)
		.with(
			{
				kind: "unavailable",
				reason: {
					kind: "owner-stored",
				},
			},
			() =>
				Effect.succeed({
					kind: "unavailable",
					reason: {
						kind: "owner-stored",
						message: "Move this item to the board to use its lines.",
					},
				} as const),
		)
		.with(
			{
				kind: "unavailable",
				reason: {
					kind: "direct-output-capacity",
				},
			},
			({ reason }) =>
				Effect.gen(function* () {
					const item = yield* resolveItemFx({
						itemId: reason.itemId,
					});
					const messageAfterTitle = readMaxCountMessageAfterTitle({
						liveQuantity: reason.liveQuantity,
						maxCount: reason.maxCount,
					});
					return {
						kind: "unavailable",
						reason: {
							...reason,
							itemTitle: item.title,
							messageAfterTitle,
							message: `${item.title} ${messageAfterTitle}`,
						},
					} as const;
				}),
		)
		.with(
			{
				kind: "unavailable",
				reason: {
					kind: "downstream-output-capacity",
				},
			},
			({ reason }) =>
				Effect.gen(function* () {
					const item = yield* resolveItemFx({
						itemId: reason.itemId,
					});
					const intermediate = yield* resolveItemFx({
						itemId: reason.intermediateItemId,
					});
					const messageAfterTitle = readMaxCountMessageAfterTitle({
						liveQuantity: reason.liveQuantity,
						maxCount: reason.maxCount,
					});
					return {
						kind: "unavailable",
						reason: {
							...reason,
							itemTitle: item.title,
							intermediateItemTitle: intermediate.title,
							messageAfterTitle,
							message: `${item.title} ${messageAfterTitle}`,
						},
					} as const;
				}),
		)
		.exhaustive();
});

/** Projects all current line facts and action readiness for one exact Item Detail owner. */
export const projectItemDetailLinesFx = Effect.fn("projectItemDetailLinesFx")(function* ({
	game,
	itemId,
	runtime,
}: projectItemDetailLinesFx.Props) {
	const lines = yield* readItemDetailLinesFx({
		itemId,
		runtime,
	});
	if (lines.kind === "unavailable") {
		return {
			kind: "unavailable",
		} satisfies projectItemDetailLinesFx.Result;
	}
	return {
		kind: "available",
		itemId: lines.itemId,
		...(lines.focusLineId === undefined
			? {}
			: {
					focusLineId: lines.focusLineId,
				}),
		line: yield* Effect.all(
			lines.line.map((line) =>
				Effect.all({
					availability: projectAvailabilityFx({
						availability: line.availability,
						game,
						runtime,
					}),
					input: Effect.all(
						line.input.map((input) =>
							projectItemDetailInputFx({
								game,
								input,
								runtime,
							}),
						),
					),
					output: Effect.succeed(
						line.output.map((set) => ({
							weight: set.weight,
							roll: set.roll.map((roll) =>
								projectItemDetailOutputRollFn({
									game,
									roll,
								}),
							),
						})),
					),
				}).pipe(
					Effect.map(({ availability, input, output }) => ({
						...line,
						availability,
						input,
						output,
					})),
				),
			),
		),
	} satisfies projectItemDetailLinesFx.Result;
});
