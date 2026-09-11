import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	createProgressAssetRuntime,
	createTemporaryProgressRuntime,
	progressAssetGame,
} from "~test/tile-presentation/support/progressAssetTestFixture";
import { readTileActorsFx } from "~/tile-presentation/fx/readTileActorsFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { NeighborhoodArtworkRuleSchema } from "~/item-definition/schema/NeighborhoodArtworkRuleSchema";

const readMainActor = (runtime: RuntimeSchema.Type) =>
	Effect.runSync(
		readTileActorsFx({
			game: progressAssetGame,
			runtime,
			surface: "main",
		}),
	)[0];

describe("readTileActorsFx", () => {
	it("overrides progress with the first neighborhood rule while retaining ordinary artwork for drag", () => {
		const runtime = createTemporaryProgressRuntime();
		const native = readMainActor(runtime);
		const ignore = {
			type: "ignore",
		};
		const rule = NeighborhoodArtworkRuleSchema.parse({
			neighbors: {
				nw: ignore,
				n: ignore,
				ne: ignore,
				w: ignore,
				e: ignore,
				sw: ignore,
				s: ignore,
				se: ignore,
			},
			sourceId: "neighborhood",
		});
		const themed = readMainActor({
			...runtime,
			items: runtime.items.map((entry) => ({
				...entry,
				item: {
					...entry.item,
					asset: {
						...entry.item.asset,
						neighbors: [
							rule,
						],
					},
				},
			})),
		});
		expect(themed).toMatchObject({
			id: native.id,
			revision: native.revision,
			location: native.location,
			sourceUrl: "resource:neighborhood",
			nativeArtwork: {
				sourceUrl: native.sourceUrl,
			},
		});
		expect(themed.compositeUrl).toBeUndefined();
		expect(native.nativeArtwork).toBeUndefined();
	});
	it("projects both default layers and drops the overlay for a progress source", () => {
		const empty = readMainActor(
			createProgressAssetRuntime({
				owner: "blueprint",
				artworkScale: 0.625,
			}),
		);
		const filled = readMainActor(
			createProgressAssetRuntime({
				owner: "blueprint",
				artworkScale: 0.625,
				storedQuantities: [
					3,
					3,
				],
			}),
		);

		expect(empty).toMatchObject({
			artworkScale: 0.625,
			sourceUrl: "resource:asset:blueprint-empty",
			compositeUrl: "resource:asset:blueprint-complete",
		});
		expect(filled).toMatchObject({
			artworkScale: 0.625,
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

	it("projects remaining uses for an idle charged non-deposit item", () => {
		expect(readMainActor(createProgressAssetRuntime())).toMatchObject({
			badgeCount: 1,
			badgeKind: "charges",
		});
	});

	it("projects temporary lifetime without an activity effect", () => {
		expect(readMainActor(createTemporaryProgressRuntime())).toMatchObject({
			activityEffect: false,
			progressRatio: 0.6,
		});
	});
});
