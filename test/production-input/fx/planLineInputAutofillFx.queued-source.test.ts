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
import { readItemDetailMaterialAutofillAvailabilityFx } from "~/item-line-detail/fx/readItemDetailMaterialAutofillAvailabilityFx";
import { clearItemJobQueueFx } from "~/production-job/fx/clearItemJobQueueFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";

it("keeps queued material identities intact, uses idle alternatives, and retries after clearing their queue", () => {
	const workshop = inputRuntimeTestConfig.items.workshop;
	if (workshop.type !== "producer") throw new Error("Expected workshop Producer.");
	const config = GameConfigSchema.parse({
		...inputRuntimeTestConfig,
		items: {
			...inputRuntimeTestConfig.items,
			recycler: {
				...workshop,
				id: "recycler",
				uid: "recycler",
				lines: [
					{
						...workshop.lines[0],
						id: "recycle",
						input: [
							{
								type: "materials",
								selector: {
									type: "item",
									itemId: "workshop",
								},
								quantity: {
									min: 2,
									max: 2,
								},
								capacity: 0,
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
				itemId: "recycler",
				location: sourceLocation(0),
				quantity: 1,
			});
			yield* spawnItemFx({
				id: "queued",
				itemId: "workshop",
				location: sourceLocation(1),
				quantity: 1,
			});
			yield* enqueueLineFx({
				ownerItemId: "receiver",
				lineId: "recycle",
			});
			yield* enqueueLineFx({
				ownerItemId: "queued",
				lineId: "line:workshop:build",
			});
			const before = yield* readRuntimeFx();

			yield* advanceRuntimeElapsedFx({
				elapsedMs: 100,
			});
			const blocked = yield* readRuntimeFx();
			expect(blocked).toEqual(before);
			const availability = yield* readItemDetailMaterialAutofillAvailabilityFx({
				ownerItemId: "receiver",
				runtime: blocked,
				selector: {
					type: "item",
					itemId: "workshop",
				},
			});
			expect(availability.availableQuantity).toBe(0);

			yield* spawnItemFx({
				id: "idle",
				itemId: "workshop",
				location: sourceLocation(2),
				quantity: 1,
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
