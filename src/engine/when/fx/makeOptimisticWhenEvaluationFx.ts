import { Array, Effect } from "effect";
import { match } from "ts-pattern";

import { SpatialRelationFx } from "~/engine/distance/context/SpatialRelationFx";
import { distanceFx } from "~/engine/distance/fx/distanceFx";
import { DistanceEnumSchema } from "~/engine/distance/schema/DistanceEnumSchema";
import { queryItemsFx } from "~/engine/query/fx/queryItemsFx";
import { QueryScopeEnumSchema } from "~/engine/query/schema/QueryScopeEnumSchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isBoardRuntimeItemFx } from "~/engine/runtime/read/isBoardRuntimeItemFx";
import type { WhenEvaluationFxService } from "~/engine/when/context/WhenEvaluationFx";
import { evaluateWhenFx } from "~/engine/when/fx/evaluateWhenFx";
import { WhenEnumSchema } from "~/engine/when/schema/WhenEnumSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

const canSatisfyWhen = (when: WhenSchema.Type, maximumQuantity: number) =>
	match(when)
		.with(
			{
				type: WhenEnumSchema.enum.Exists,
			},
			() => maximumQuantity >= 1,
		)
		.with(
			{
				type: WhenEnumSchema.enum.Count,
			},
			({ count }) => count <= maximumQuantity,
		)
		.with(
			{
				type: WhenEnumSchema.enum.Range,
			},
			({ min }) => min <= maximumQuantity,
		)
		.exhaustive();

const canFalsifyWhen = (when: WhenSchema.Type, maximumQuantity: number) =>
	match(when)
		.with(
			{
				type: WhenEnumSchema.enum.Exists,
			},
			() => true,
		)
		.with(
			{
				type: WhenEnumSchema.enum.Count,
			},
			({ count }) => count !== 0 || maximumQuantity > 0,
		)
		.with(
			{
				type: WhenEnumSchema.enum.Range,
			},
			({ max, min }) => min > 0 || maximumQuantity > max,
		)
		.exhaustive();

/**
 * Builds the planner's existential evaluator for non-self board geometry.
 *
 * Selector, same-space existence and total available quantity remain canonical.
 * Non-self geometry may distribute that integer quantity inside or outside the
 * relation, while non-board and self conditions stay exact. Every condition
 * chooses its own existential layout; this policy deliberately does not construct
 * one shared physical-layout witness across a complete rule set.
 */
export const makeOptimisticWhenEvaluationFx = Effect.fn("makeOptimisticWhenEvaluationFx")(
	function* () {
		const evaluate: WhenEvaluationFxService["evaluate"] = (props) =>
			Effect.gen(function* () {
				const { intent, origin, when } = props;
				if (intent === undefined) {
					return yield* evaluateWhenFx(props).pipe(
						Effect.provideService(SpatialRelationFx, {
							matches: distanceFx,
						}),
					);
				}
				if (
					when.query.scope !== QueryScopeEnumSchema.enum.Board ||
					when.query.distance === DistanceEnumSchema.enum.Self
				)
					return yield* evaluateWhenFx(props);

				const items = yield* getItemsFx();
				const boardItems = Array.getSomes(
					yield* Effect.forEach(items, isBoardRuntimeItemFx),
				);
				const selected = yield* queryItemsFx({
					items: boardItems.filter(
						(item) =>
							item.location.space === origin.space &&
							(item.location.position.x !== origin.position.x ||
								item.location.position.y !== origin.position.y),
					),
					selector: when.query.selector,
				});
				const maximumQuantity = selected.reduce(
					(quantity, item) => quantity + item.quantity,
					0,
				);
				return intent === "satisfy"
					? canSatisfyWhen(when, maximumQuantity)
					: !canFalsifyWhen(when, maximumQuantity);
			});

		return {
			evaluate,
		} satisfies WhenEvaluationFxService;
	},
);
