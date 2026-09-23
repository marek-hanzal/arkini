import { commitMoveDropFx } from "~/item-interaction/fx/commitMoveDropFx";
import { readDropItemPreviewFx } from "~/item-interaction/fx/readDropItemPreviewFx";
import { readGameAudioCuesFn } from "~/game-audio/fn/readGameAudioCuesFn";
import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { useGameFx } from "~test/support/useGameFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { DropItemRejectedReason } from "~/item-interaction/type/DropItemResult";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";

import {
	config,
	emptyLocation,
	occupiedLocation,
	run,
	sourceLocation,
} from "../support/dropItemFixture";

describe("dropItemFx / move storage and swap", () => {
	it("moves one exact source to an empty slot and returns explicit identities", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemUid: "water",
					location: sourceLocation,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: emptyLocation,
						occupant: null,
					},
				});
				const runtime = yield* readRuntimeFx();
				return {
					outcome,
					runtime,
					transition: yield* (yield* CommittedTransitionsFx).read,
				};
			}),
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKind.Move,
			itemId: "runtime:water",
			previousLocation: sourceLocation,
			location: emptyLocation,
		});
		expect(result.runtime.items[0]?.location).toEqual(emptyLocation);
		expect(result.transition.events).toEqual([
			{
				type: GameEventEnumSchema.enum.ItemPlaced,
				itemId: "runtime:water",
				itemUid: "water",
				originItemId: "runtime:water",
				previousLocation: sourceLocation,
				location: emptyLocation,
			},
		]);
	});

	it("serializes competing public moves into one empty slot", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const first = yield* spawnItemFx({
					id: "runtime:water",
					itemUid: "water",
					location: sourceLocation,
				});
				const secondLocation = {
					scope: "board" as const,
					space: 0,
					position: {
						x: 1,
						y: 1,
					},
				};
				const second = yield* spawnItemFx({
					id: "runtime:stone",
					itemUid: "stone",
					location: secondLocation,
				});
				const target = {
					kind: "slot" as const,
					location: emptyLocation,
					occupant: null,
				};
				const attempts = yield* Effect.all(
					[
						dropItemFx({
							sourceItemId: first.id,
							sourceRevision: first.revision,
							sourceLocation: first.location,
							target,
						}),
						dropItemFx({
							sourceItemId: second.id,
							sourceRevision: second.revision,
							sourceLocation: second.location,
							target,
						}),
					],
					{
						concurrency: "unbounded",
					},
				);
				return {
					attempts,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.attempts.filter(({ kind }) => kind === DropItemResultKind.Move)).toHaveLength(
			1,
		);
		expect(result.attempts).toContainEqual({
			kind: DropItemResultKind.Reject,
			reason: DropItemRejectedReason.Occupied,
			itemId: expect.stringMatching(/^runtime:(?:water|stone)$/),
		});
		expect(
			result.runtime.items.filter(
				(item) =>
					item.location.scope === "board" &&
					item.location.position.x === emptyLocation.position.x &&
					item.location.position.y === emptyLocation.position.y,
			),
		).toHaveLength(1);
	});
	it("swaps two non-mergeable occupied Board items and returns both actor identities", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemUid: "water",
					location: sourceLocation,
				});
				const target = yield* spawnItemFx({
					id: "runtime:stone",
					itemUid: "stone",
					location: occupiedLocation,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: occupiedLocation,
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
					},
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
					transition: yield* (yield* CommittedTransitionsFx).read,
				};
			}),
		);

		expect(result.transition.events).toEqual([
			{
				type: GameEventEnumSchema.enum.ItemSwapped,
				sourceItemId: "runtime:water",
				sourceItemUid: "water",
				targetItemId: "runtime:stone",
				targetItemUid: "stone",
				sourceLocation,
				targetLocation: occupiedLocation,
			},
		]);
		expect(readGameAudioCuesFn(result.transition, {})).toEqual([
			{
				event: GameEventEnumSchema.enum.ItemSwapped,
				strength: 1,
			},
		]);
		expect(result.outcome).toMatchObject({
			kind: DropItemResultKind.Swap,
			source: {
				itemId: "runtime:water",
				previousLocation: sourceLocation,
				location: occupiedLocation,
			},
			target: {
				itemId: "runtime:stone",
				previousLocation: occupiedLocation,
				location: sourceLocation,
			},
		});
		expect(result.runtime.items.find((item) => item.id === "runtime:water")?.location).toEqual(
			occupiedLocation,
		);
		expect(result.runtime.items.find((item) => item.id === "runtime:stone")?.location).toEqual(
			sourceLocation,
		);
	});
});

it("rejects a new move outside configured bounds at commit without rejecting existing saved coordinates", () => {
	const result = run(
		Effect.gen(function* () {
			const source = yield* spawnItemFx({
				id: "runtime:water",
				itemUid: "water",
				location: sourceLocation,
			});
			const before = yield* readRuntimeFx();
			const outcome = yield* commitMoveDropFx({
				sourceItemId: source.id,
				sourceRevision: source.revision,
				sourceLocation,
				targetLocation: {
					...emptyLocation,
					position: {
						x: config.meta.board.width,
						y: 0,
					},
				},
			});
			return {
				before,
				after: yield* readRuntimeFx(),
				outcome,
			};
		}),
	);
	expect(result.outcome).toMatchObject({
		kind: DropItemResultKind.Reject,
		reason: DropItemRejectedReason.InvalidTarget,
	});
	expect(result.after).toBe(result.before);
});

it("rejects an empty target in another space in both preview and commit", () => {
	const targetLocation = {
		...emptyLocation,
		space: 1,
	};
	const result = run(
		Effect.gen(function* () {
			const source = yield* spawnItemFx({
				id: "runtime:water",
				itemUid: "water",
				location: sourceLocation,
			});
			const before = yield* readRuntimeFx();
			const preview = yield* readDropItemPreviewFx({
				sourceItemId: source.id,
				sourceRevision: source.revision,
				sourceLocation,
				target: {
					kind: "slot",
					location: targetLocation,
					occupant: null,
				},
			});
			const commit = yield* commitMoveDropFx({
				sourceItemId: source.id,
				sourceRevision: source.revision,
				sourceLocation,
				targetLocation,
			});
			return {
				before,
				after: yield* readRuntimeFx(),
				preview,
				commit,
			};
		}),
	);

	expect(result.preview).toEqual({
		kind: DropItemResultKind.Reject,
		reason: DropItemRejectedReason.InvalidTarget,
	});
	expect(result.commit).toMatchObject({
		kind: DropItemResultKind.Reject,
		reason: DropItemRejectedReason.InvalidTarget,
	});
	expect(result.after).toBe(result.before);
});
