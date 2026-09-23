import { Effect } from "effect";
import { expect, it } from "vitest";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { useGameFx } from "~test/support/useGameFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";

it("commits a production template reset without resurrecting captured reserved material", () => {
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
	config.items.forge!.lines[0]!.outcome = {
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
	};
	Effect.runSync(
		Effect.gen(function* () {
			const owner = yield* prepareJobLineFx();
			yield* startLineFx({
				ownerItemId: owner.id,
				lineId: "line:forge:run",
			});
			expect(
				(yield* readRuntimeFx()).items.some((item) => item.location.scope === "reserved"),
			).toBe(true);
			yield* runTickRuntimeByFx({
				elapsedMs: 5000,
			});
			const runtime = yield* readRuntimeFx();
			expect(runtime.items).toEqual([]);
			expect(runtime.jobs).toEqual([]);
			expect(runtime.jobQueue).toEqual([]);
			expect(runtime.templateUidBySpace).toEqual({
				0: "empty",
			});
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
});
