import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { tileMotionCueTestFixture } from "~test/tile-presentation/support/tileMotionCueTestFixture";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";

const { committedRuntime, readCues, runtime, source, sourceLocation, target, targetLocation } =
	tileMotionCueTestFixture;

describe("readTileMotionCuesFx", () => {
	it("keeps stagger indexes local to each producer in one committed transition", () => {
		const cues = Effect.runSync(
			readCues({
				sequence: 8,
				previousRuntime: runtime,
				runtime: committedRuntime,
				events: [
					{
						type: GameEventEnumSchema.enum.ItemSpawned,
						itemId: target.id,
						itemUid: target.item.uid,
						originItemId: source.id,
						location: targetLocation,
					},
					{
						type: GameEventEnumSchema.enum.ItemSpawned,
						itemId: source.id,
						itemUid: source.item.uid,
						originItemId: target.id,
						location: sourceLocation,
					},
					{
						type: GameEventEnumSchema.enum.ItemSpawned,
						itemId: target.id,
						itemUid: target.item.uid,
						originItemId: source.id,
						location: targetLocation,
					},
				],
			}),
		);

		expect(cues.map((cue) => cue.staggerIndex)).toEqual([
			0,
			0,
			1,
		]);
	});

	it("compiles a board input store as whole-source delivery to its live owner", () => {
		expect(
			Effect.runSync(
				readCues({
					sequence: 10,
					previousRuntime: runtime,
					runtime: committedRuntime,
					events: [
						{
							type: GameEventEnumSchema.enum.ItemInputStored,
							sourceItemId: source.id,
							itemUid: source.item.uid,
							previousSourceLocation: sourceLocation,
							ownerItemId: target.id,
							lineId: "line:water",
							inputIndex: 0,
						},
					],
				}),
			),
		).toEqual([
			{
				kind: "input",
				sequence: 10,
				eventIndex: 0,
				staggerIndex: 0,
				sourceActorId: source.id,
				targetActorId: target.id,
				itemUid: source.item.uid,
				originActorId: source.id,
				originLocation: sourceLocation,
				targetLocation,
			},
		]);
	});

	it("degrades stale or missing visual identities to no choreography", () => {
		const cues = Effect.runSync(
			readCues({
				sequence: 8,
				previousRuntime: runtime,
				runtime: committedRuntime,
				events: [
					{
						type: GameEventEnumSchema.enum.ItemSpawned,
						itemId: target.id,
						itemUid: "fire",
						originItemId: source.id,
						location: targetLocation,
					},
					{
						type: GameEventEnumSchema.enum.ItemSpawned,
						itemId: "runtime:missing",
						itemUid: target.item.uid,
						originItemId: source.id,
						location: targetLocation,
					},
				],
			}),
		);

		expect(cues).toEqual([]);
	});
});

it.each([
	true,
	false,
])("projects a same-slot spawn regardless of whether the source survives (%s)", (removed) => {
	const cues = Effect.runSync(
		readCues({
			sequence: 50,
			previousRuntime: runtime,
			runtime: {
				...runtime,
				items: runtime.items
					.filter((item) => !removed || item.id !== source.id)
					.map((item) =>
						item.id === target.id
							? {
									...item,
									location: sourceLocation,
								}
							: item,
					),
			},
			events: [
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: target.id,
					itemUid: target.item.uid,
					originItemId: source.id,
					location: sourceLocation,
				},
			],
		}),
	);
	expect(cues).toHaveLength(1);
	expect(cues[0]).toMatchObject({
		kind: "spawn",
		targetLocation: sourceLocation,
	});
});
