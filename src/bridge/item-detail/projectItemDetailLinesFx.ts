import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { projectItemDetailInputFx } from "~/bridge/item-detail/projectItemDetailInputFx";
import { projectItemDetailOutputRollFx } from "~/bridge/item-detail/projectItemDetailOutputRollFx";
import { projectItemDetailSelectorFx } from "~/bridge/item-detail/projectItemDetailSelectorFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemDetailLines as EngineItemDetailLines } from "~/engine/item-detail/read/ItemDetailLines";
import { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";
import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { match } from "ts-pattern";
import { WhenEnumSchema } from "~/engine/when/schema/WhenEnumSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

export namespace projectItemDetailLinesFx {
	export interface Props {
		readonly game: GameEngine;
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Result = ItemDetailLines.Projection;
}

const projectDisabledRuleMessageFx = Effect.fn("projectDisabledRuleMessageFx")(function* ({
	cause,
	game,
}: {
	readonly cause: Extract<
		EngineItemDetailLines.UnavailableReason,
		{
			readonly kind: "line-disabled";
		}
	>["cause"];
	readonly game: GameEngine;
}) {
	if (cause.kind === "static") return "This line is currently disabled.";
	const projectConditionFx = Effect.fn("projectDisabledRuleConditionFx")(function* (
		when: WhenSchema.Type,
	) {
		const selector = yield* projectItemDetailSelectorFx({
			game,
			selector: when.query.selector,
		});
		return match(when)
			.with(
				{
					type: WhenEnumSchema.enum.Exists,
				},
				() => selector.label,
			)
			.with(
				{
					type: WhenEnumSchema.enum.Count,
				},
				({ count }) => `${count} ${selector.label}`,
			)
			.with(
				{
					type: WhenEnumSchema.enum.Range,
				},
				({ max, min }) => `${min}-${max} ${selector.label}`,
			)
			.exhaustive();
	});
	if (cause.kind === "enable-rule") {
		return `Requires ${yield* projectConditionFx(cause.when)}.`;
	}
	const conditions = yield* Effect.all(cause.when.map(projectConditionFx));
	return `Unavailable while ${conditions.join(" and ")} match.`;
});

const projectAvailabilityFx = Effect.fn("projectItemDetailLineAvailabilityFx")(function* ({
	availability,
	game,
}: {
	readonly availability: EngineItemDetailLines.Availability;
	readonly game: GameEngine;
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
					const message = yield* projectDisabledRuleMessageFx({
						cause: reason.cause,
						game,
					});
					const cause =
						reason.cause.kind === "static"
							? reason.cause
							: reason.cause.kind === "enable-rule"
								? {
										kind: reason.cause.kind,
										ruleIndex: reason.cause.ruleIndex,
										whenIndex: reason.cause.whenIndex,
									}
								: {
										kind: reason.cause.kind,
										ruleIndex: reason.cause.ruleIndex,
									};
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
					kind: "direct-output-max-count",
				},
			},
			({ reason }) =>
				Effect.gen(function* () {
					const item = yield* resolveItemFx({
						itemId: reason.itemId,
					});
					return {
						kind: "unavailable",
						reason: {
							...reason,
							itemTitle: item.title,
							message: `${item.title} limit reached (${reason.liveQuantity + reason.reservedQuantity}/${reason.maxCount}).`,
						},
					} as const;
				}),
		)
		.with(
			{
				kind: "unavailable",
				reason: {
					kind: "downstream-output-max-count",
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
					return {
						kind: "unavailable",
						reason: {
							...reason,
							itemTitle: item.title,
							intermediateItemTitle: intermediate.title,
							message: `${item.title} limit reached (${reason.liveQuantity + reason.reservedQuantity}/${reason.maxCount}).`,
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
		line: yield* Effect.all(
			lines.line.map((line) =>
				Effect.all({
					availability: projectAvailabilityFx({
						availability: line.availability,
						game,
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
	} satisfies projectItemDetailLinesFx.Result;
});
