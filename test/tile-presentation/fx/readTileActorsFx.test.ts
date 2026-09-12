import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	createTileActorRuntime,
	createTemporaryTileActorRuntime,
	tileActorGame,
} from "~test/tile-presentation/support/tileActorTestFixture";
import { readTileActorsFx } from "~/tile-presentation/fx/readTileActorsFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

const readMainActor = (runtime: RuntimeSchema.Type) =>
	Effect.runSync(
		readTileActorsFx({
			game: tileActorGame,
			runtime,
			surface: "main",
		}),
	)[0];

describe("readTileActorsFx", () => {
	it("projects the complete default artwork composition with its authored scale", () => {
		const empty = readMainActor(
			createTileActorRuntime({
				owner: "blueprint",
				artworkScale: 0.625,
			}),
		);

		expect(empty).toMatchObject({
			artworkScale: 0.625,
			sourceUrl: "resource:asset:blueprint-base",
			compositeUrl: "resource:asset:blueprint-overlay",
		});
	});

	it("projects active work progress, activity, and queue count", () => {
		expect(
			readMainActor(
				createTileActorRuntime({
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

	it("projects remaining uses for an idle charged non-deposit item", () => {
		expect(readMainActor(createTileActorRuntime())).toMatchObject({
			badgeCount: 1,
			badgeKind: "charges",
		});
	});

	it("projects temporary lifetime without an activity effect", () => {
		expect(readMainActor(createTemporaryTileActorRuntime())).toMatchObject({
			activityEffect: false,
			progressRatio: 0.6,
		});
	});
});
