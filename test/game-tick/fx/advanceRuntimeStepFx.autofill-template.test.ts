import { Effect } from "effect";
import { expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { advanceRuntimeStepFx } from "~/game-tick/fx/advanceRuntimeStepFx";
import {
	boardFn,
	createContendedQueueConfigFn,
	itemFn,
	prepareQueueFx,
	requestFn,
} from "./advanceRuntimeStepFx.queue.test/queueRuntime";

it("does not announce Autofill erased by a later payer Template reset in the same queue pass", () => {
	const base = createContendedQueueConfigFn();
	const config = GameConfigSchema.parse({
		...base,
		templates: [
			{
				uid: "empty",
				title: "Empty",
				width: 5,
				height: 2,
				board: [],
			},
		],
		items: {
			...base.items,
			forge: {
				...base.items.forge,
				lines: base.items.forge.lines.map((line) =>
					line.id === "line:later"
						? {
								...line,
								input: line.input.map((input) =>
									input.type === "units"
										? {
												...input,
												units: {
													...input.units,
													cost: 1,
												},
											}
										: input,
								),
							}
						: line,
				),
			},
			payer: {
				...base.items.payer,
				units: {
					amount: 1,
					outcome: {
						set: [
							{
								weight: 1,
								rules: [],
								roll: [
									{
										type: "guaranteed",
										outcome: [
											{
												type: "template",
												templateUid: "empty",
												rules: [],
											},
										],
									},
								],
							},
						],
					},
				},
			},
		},
	});
	const result = Effect.runSync(
		Effect.gen(function* () {
			const prepared = yield* prepareQueueFx(
				[
					requestFn("request:autofill", "line:older"),
					requestFn("request:reset", "line:later", "owner:b"),
				],
				[
					itemFn("owner:b", "forge", boardFn(1)),
					itemFn("payer", "water", boardFn(2)),
					itemFn("tool", "tool", boardFn(4)),
				],
			);
			return yield* advanceRuntimeStepFx({
				...prepared,
				items: prepared.items.map((item) => ({
					...item,
					item: config.items[
						item.id === "owner:a" || item.id === "owner:b" ? "forge" : item.id
					]!,
				})),
			});
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);

	expect(result.runtime.items).toEqual([]);
	expect(result.runtime.jobQueue).toEqual([]);
	expect(result.runtime.templateUidBySpace[0]).toBe("empty");
	expect(result.events.some((event) => event.type === "board:template-applied")).toBe(true);
	expect(result.events.some((event) => event.type === "line-input:autofill-started")).toBe(false);
});
