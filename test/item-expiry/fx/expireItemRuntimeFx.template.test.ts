import { Effect } from "effect";
import { expect, it } from "vitest";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";
import { useGameFx } from "~test/support/useGameFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { settleTerminalItemRuntimeFx } from "~/item-terminal/fx/settleTerminalItemRuntimeFx";

it("uses expiry entry ancestry when its owner and buffers did not exist in the ambient snapshot", () => {
	const config = createJobTestConfig();
	config.templates = [
		{
			uid: "empty",
			title: "Empty",
			width: 2,
			height: 2,
			board: [],
		},
	];
	Effect.runSync(
		Effect.gen(function* () {
			const earlier = yield* readRuntimeFx();
			const owner = yield* prepareJobLineFx();
			const runtime = yield* readRuntimeFx();
			expect(runtime.items.some((item) => item.location.scope === "input")).toBe(true);
			const expired = yield* settleTerminalItemRuntimeFx({
				cause: "expired",
				item: owner,
				origin: {
					scope: "board",
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
				runtime,
				randomSeed: "expiry",
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
			}).pipe(
				Effect.provideService(RuntimeFx, {
					read: Effect.succeed(earlier),
				}),
			);
			expect(expired.runtime.items).toEqual([]);
			expect(expired.runtime.templateUidBySpace).toEqual({
				0: "empty",
			});
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
});
