import { Effect } from "effect";
import { match } from "ts-pattern";

import { resolveItemFx } from "~/item-resolution/fx/resolveItemFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";
import type { ItemDetailLines as EngineItemDetailLines } from "~/item-line-detail/type/ItemDetailLines";
import { readItemDetailLinesFx } from "~/item-line-detail/fx/readItemDetailLinesFx";
import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { projectItemDetailReferenceFx } from "~/item-detail-frame/fx/projectItemDetailReferenceFx";
import { TypeSchema } from "~/production-condition/schema/TypeSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";
import type { GameEngine } from "~/playable-game/type/GameEngine";

type ProjectedLineDisabledCause = Extract<
	ItemDetailLinesProjection.DisabledReason,
	{
		readonly kind: "line-disabled";
	}
>["cause"];

const projectItemDetailSelectorFn = ({
	items,
	selector,
}: {
	readonly items: GameEngine["config"]["items"];
	readonly selector: SelectorSchema.Type;
}) => ({
	kind: "item" as const,
	label: items[selector.itemId]?.title ?? selector.itemId,
});

const projectOutputItemFx = Effect.fn("projectOutputItemFx")(function* ({
	game,
	item,
}: {
	readonly game: GameEngine;
	readonly item: EngineItemDetailLines.OutputItem;
}) {
	return yield* Effect.sync(() => {
		const configured = game.config.items[item.itemId];
		if (configured === undefined) {
			return {
				itemId: item.itemId,
				title: item.itemId,
				quantity: item.quantity,
				activeRuleHints: item.activeRuleHints,
			} satisfies ItemDetailLinesProjection.OutputItem;
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
		} satisfies ItemDetailLinesProjection.OutputItem;
	});
});

const projectItemDetailOutputRollFx = Effect.fn("projectItemDetailOutputRollFx")(function* ({
	game,
	roll,
}: {
	readonly game: GameEngine;
	readonly roll: EngineItemDetailLines.LineOutputRoll;
}) {
	return yield* match(roll)
		.with(
			{
				kind: "guaranteed",
			},
			(guaranteed) =>
				Effect.all(
					guaranteed.item.map((item) =>
						projectOutputItemFx({
							game,
							item,
						}),
					),
				).pipe(
					Effect.map((item) => ({
						kind: "guaranteed" as const,
						item,
					})),
				),
		)
		.with(
			{
				kind: "chance",
			},
			(chance) =>
				Effect.all(
					chance.item.map((item) =>
						projectOutputItemFx({
							game,
							item,
						}),
					),
				).pipe(
					Effect.map((item) => ({
						kind: "chance" as const,
						chance: chance.chance,
						item,
					})),
				),
		)
		.with(
			{
				kind: "weight",
			},
			(weight) =>
				Effect.all(
					weight.option.map((option) =>
						Effect.all(
							option.item.map((item) =>
								projectOutputItemFx({
									game,
									item,
								}),
							),
						).pipe(
							Effect.map((item) => ({
								weight: option.weight,
								item,
							})),
						),
					),
				).pipe(
					Effect.map((option) => ({
						kind: "weight" as const,
						selections: weight.selections,
						option,
					})),
				),
		)
		.exhaustive();
});

const readQueryLocationLabelFn = (query: WhenSchema.Type["query"]) =>
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

const readMaxCountMessageAfterTitleFn = ({
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
		items: game.config.items,
		selector: when.query.selector,
	});
	const locationLabel = readQueryLocationLabelFn(when.query);
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
				} satisfies ItemDetailLinesProjection.DisabledCondition,
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
				} satisfies ItemDetailLinesProjection.DisabledCondition,
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
				} satisfies ItemDetailLinesProjection.DisabledCondition,
				phrase: `${min}-${max} ${selector.label}`,
			}),
		)
		.exhaustive();
});

const projectItemDetailInputFx = Effect.fn("projectItemDetailInputFx")(function* ({
	game,
	input,
	runtime,
}: {
	readonly game: GameEngine;
	readonly input: EngineItemDetailLines.Input;
	readonly runtime: RuntimeSchema.Type;
}) {
	return yield* match(input)
		.with(
			{
				kind: "materials",
			},
			(materials) =>
				Effect.gen(function* () {
					const selector = projectItemDetailSelectorFn({
						items: game.config.items,
						selector: materials.selector,
					});
					const detail = yield* projectItemDetailReferenceFx({
						game,
						itemId: materials.selector.itemId,
						runtime,
					});
					return {
						...materials,
						selector,
						...(detail === undefined
							? {}
							: {
									detail,
								}),
					} satisfies ItemDetailLinesProjection.Input;
				}),
		)
		.with(
			{
				kind: "deposit",
			},
			(deposit) =>
				Effect.gen(function* () {
					const selector = projectItemDetailSelectorFn({
						items: game.config.items,
						selector: deposit.selector,
					});
					const exactTargetId =
						deposit.targetItemIds.length === 1 ? deposit.targetItemIds[0] : undefined;
					const detail = yield* projectItemDetailReferenceFx({
						game,
						itemId: deposit.selector.itemId,
						preferredRuntimeItemIds:
							exactTargetId === undefined
								? []
								: [
										exactTargetId,
									],
						runtime,
					});
					return {
						kind: deposit.kind,
						selector,
						distance: deposit.distance,
						requiredCharges: deposit.requiredCharges,
						availableCharges: deposit.availableCharges,
						availableChargesLabel:
							deposit.targetItemIds.length === 0
								? "None"
								: String(deposit.availableCharges),
						targetTitles: deposit.targetItemIds.map(
							(itemId) =>
								runtime.items.find((item) => item.id === itemId)?.item.title ??
								itemId,
						),
						ready: deposit.ready,
						...(deposit.charges === undefined
							? {}
							: {
									charges: deposit.charges,
								}),
						...(detail === undefined
							? {}
							: {
									detail,
								}),
					} satisfies ItemDetailLinesProjection.Input;
				}),
		)
		.with(
			{
				kind: "simple",
			},
			(simple) => Effect.succeed(simple),
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
						items: game.config.items,
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
					const messageAfterTitle = readMaxCountMessageAfterTitleFn({
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
					const messageAfterTitle = readMaxCountMessageAfterTitleFn({
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
}: {
	readonly game: GameEngine;
	readonly itemId: EngineItemDetailLines.Props["itemId"];
	readonly runtime: RuntimeSchema.Type;
}) {
	const lines = yield* readItemDetailLinesFx({
		itemId,
		runtime,
	});
	if (lines.kind === "unavailable") {
		return {
			kind: "unavailable",
		} satisfies ItemDetailLinesProjection.Projection;
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
					output: Effect.all(
						line.output.map((set) =>
							Effect.all(
								set.roll.map((roll) =>
									projectItemDetailOutputRollFx({
										game,
										roll,
									}),
								),
							).pipe(
								Effect.map((roll) => ({
									weight: set.weight,
									roll,
								})),
							),
						),
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
	} satisfies ItemDetailLinesProjection.Projection;
});
