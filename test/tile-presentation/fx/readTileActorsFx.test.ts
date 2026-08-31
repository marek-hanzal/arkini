import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	createProgressAssetRuntime,
	createTemporaryProgressRuntime,
	progressAssetGame,
} from "~test/tile-presentation/support/progressAssetTestFixture";
import { readTileActorsFx } from "~/tile-presentation/fx/readTileActorsFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

const readMainActor = (runtime: RuntimeSchema.Type) =>
	Effect.runSync(
		readTileActorsFx({
			game: progressAssetGame,
			runtime,
			surface: "main",
		}),
	)[0];

describe("readTileActorsFx", () => {
	it("projects both default layers and drops the overlay for a progress source", () => {
		const empty = readMainActor(
			createProgressAssetRuntime({
				owner: "blueprint",
			}),
		);
		const filled = readMainActor(
			createProgressAssetRuntime({
				owner: "blueprint",
				storedQuantities: [
					3,
					3,
				],
			}),
		);

		expect(empty).toMatchObject({
			sourceUrl: "resource:asset:blueprint-empty",
			compositeUrl: "resource:asset:blueprint-complete",
		});
		expect(filled).toMatchObject({
			sourceUrl: "resource:asset:blueprint-complete",
		});
		expect(filled).not.toHaveProperty("compositeUrl");
	});

	it("projects active work progress, activity, and queue count", () => {
		expect(
			readMainActor(
				createProgressAssetRuntime({
					active: true,
					queued: 2,
				}),
			),
		).toMatchObject({
			activityEffect: true,
			badgeCount: 3,
			badgeKind: "queue",
			progressRatio: 0.5,
		});
	});

	it("projects temporary lifetime without an activity effect", () => {
		expect(readMainActor(createTemporaryProgressRuntime())).toMatchObject({
			activityEffect: false,
			progressRatio: 0.6,
		});
	});
});
