import { Effect } from "effect";
import { expect, it } from "vitest";

import {
	inputRuntimeTestConfig,
	sourceLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { advanceRuntimeElapsedFx } from "~/game-tick/fx/advanceRuntimeElapsedFx";
import { clearItemJobQueueFx } from "~/production-job/fx/clearItemJobQueueFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";

it("keeps queued material identities intact, uses idle alternatives, and retries after clearing their queue", () => {
	const workshop = inputRuntimeTestConfig.items.workshop;
	const config = GameConfigSchema.parse({
		...inputRuntimeTestConfig,
		items: {
			...inputRuntimeTestConfig.items,
			recycler: {
				...workshop,
				uid: "recycler",
				lines: [
					{
						...workshop.lines[0],
						uid: "recycle",
						input: [
							{
								type: "materials",
								query: {
									distance: "far" as const,
									selector: {
										type: "item",
										itemUid: "workshop",
									},
								},
								quantity: {
									min: 2,
									max: 2,
								},
							},
						],
					},
				],
			},
		},
	});
	Effect.runSync(
		Effect.gen(function* () {
			yield* spawnItemFx({
				id: "receiver",
				itemUid: "recycler",
				location: sourceLocation(0),
			});
			yield* spawnItemFx({
				id: "queued",
				itemUid: "workshop",
				location: sourceLocation(1),
			});
			yield* enqueueLineFx({
				ownerItemId: "receiver",
				lineUid: "recycle",
			});
			yield* enqueueLineFx({
				ownerItemId: "queued",
				lineUid: "line:workshop:build",
			});
			const before = yield* readRuntimeFx();

			yield* advanceRuntimeElapsedFx({
				elapsedMs: 100,
			});
			const blocked = yield* readRuntimeFx();
			expect(blocked).toEqual(before);

			yield* spawnItemFx({
				id: "idle",
				itemUid: "workshop",
				location: sourceLocation(2),
			});
			yield* advanceRuntimeElapsedFx({
				elapsedMs: 100,
			});
			const alternate = yield* readRuntimeFx();
			expect(alternate.items.find(({ id }) => id === "idle")).toMatchObject({
				location: {
					scope: "delivery",
					phase: "outbound",
					target: {
						ownerItemId: "receiver",
					},
				},
			});
			expect(alternate.items.find(({ id }) => id === "queued")).toEqual(
				before.items.find(({ id }) => id === "queued"),
			);
			expect(alternate.jobQueue).toEqual(before.jobQueue);
			expect(alternate.defaultLineByOwnerItemId).toEqual(before.defaultLineByOwnerItemId);

			yield* clearItemJobQueueFx({
				ownerItemId: "queued",
			});
			yield* advanceRuntimeElapsedFx({
				elapsedMs: 100,
			});
			const retried = yield* readRuntimeFx();
			expect(retried.items.find(({ id }) => id === "queued")).toMatchObject({
				location: {
					scope: "delivery",
					phase: "outbound",
					target: {
						ownerItemId: "receiver",
					},
				},
			});
			expect(retried.jobQueue).toEqual(
				before.jobQueue.filter(({ ownerItemId }) => ownerItemId === "receiver"),
			);
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
});
