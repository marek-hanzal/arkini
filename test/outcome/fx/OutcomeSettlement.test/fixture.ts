import { Effect } from "effect";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { resolveOutcomeTableFx } from "~/outcome/fx/resolveOutcomeTableFx";
import { applyOutcomeTableFx } from "~/outcome/fx/applyOutcomeTableFx";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";
import type { SpaceDestinationSchema } from "~/space/schema/SpaceDestinationSchema";

export const origin = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};
export const itemOutcome = {
	type: "item",
	itemUid: "reward",
	quantity: {
		min: 1,
		max: 1,
	},
	placement: "drop",
	rules: [],
} as const;
export const tableFn = (outcome: readonly OutcomeSchema.Type[]) =>
	OutcomeTableSchema.parse({
		set: [
			{
				weight: 1,
				rules: [],
				roll: [
					{
						type: "guaranteed",
						outcome,
					},
				],
			},
		],
	});
export const spaceFn = (space: SpaceDestinationSchema.Type): OutcomeSchema.Type => ({
	type: "space",
	space,
	rules: [],
});
const definitionFn = (id: string) => ({
	uid: id,

	title: id,
	artwork: {
		scale: 1,
		default: [
			id,
		],
	},
	lines: [],
});
export const configFn = (outcome: OutcomeTableSchema.Type, width = 3) =>
	GameConfigSchema.parse({
		resources: {
			hero: "hero",
		},
		meta: {
			id: "outcome-settlement",
			title: "Outcomes",
			board: {
				width,
				height: 1,
			},
		},
		start: {
			currentSpace: 0,
			spaces: [],
		},
		items: {
			owner: {
				...definitionFn("owner"),
				lines: [
					{
						uid: "run",
						title: "Run",
						description: "Run",
						default: true,
						show: true,
						enable: true,
						runtimeMs: 0,
						input: [
							{
								type: "simple",
							},
						],
						rules: [],
						outcome,
					},
				],
			},
			reward: definitionFn("reward"),
		},
	});
export const spawnOwnerFx = () =>
	spawnItemFx({
		id: "owner-live",
		itemUid: "owner",
		location: origin,
	});

export const settleFx = (outcome: OutcomeTableSchema.Type) =>
	modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const resolved = yield* resolveOutcomeTableFx({
				ownerItemId: "test-outcome-owner",
				origin,
				outcome,
			});
			const [placement, next] = yield* applyOutcomeTableFx({
				outcome: resolved,
				runtime,
			});
			return [
				placement,
				next,
			] as const;
		}),
	);
