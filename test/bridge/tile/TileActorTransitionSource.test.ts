// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { readTileActorTransitionFx } from "~/bridge/tile/readTileActorTransitionFx";
import {
	type TileActorTransitionSource,
	useTileActorTransitionSource,
} from "~/bridge/tile/useTileActorTransitionSource";
import type { CommittedTransitionSchema } from "~/engine/runtime/schema/CommittedTransitionSchema";

const gameState = vi.hoisted(() => ({
	game: null as GameEngine | null,
}));

const projectionState = vi.hoisted(() => ({
	includePreviousItems: [] as boolean[],
	failureSequence: null as number | null,
}));

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => {
		if (gameState.game === null) throw new Error("Missing test Game Engine.");
		return gameState.game;
	},
}));

vi.mock("~/bridge/tile/readTileActorTransitionFx", () => ({
	readTileActorTransitionFx: ({
		transition,
		includePreviousItems,
	}: {
		readonly transition: TestTransition;
		readonly includePreviousItems: boolean;
	}) => {
		projectionState.includePreviousItems.push(includePreviousItems);
		if (projectionState.failureSequence === transition.sequence) {
			throw new Error("Projection failed.");
		}
		return {
			...transition.projected,
			previousItems: includePreviousItems ? transition.projected.previousItems : null,
		};
	},
}));

type TestTransition = CommittedTransitionSchema.Type & {
	readonly projected: readTileActorTransitionFx.Result;
};

const roots: Array<ReturnType<typeof createRoot>> = [];
let captured: TileActorTransitionSource | null = null;

const item = (overrides: Partial<TileActorItem> = {}): TileActorItem => ({
	id: "runtime:water",
	revision: "revision:water:1",
	itemId: "water",
	title: "Water",
	quantity: 1,
	sourceUrl: "arkini://water",
	location: {
		scope: "board",
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	running: false,
	primaryAction: {
		kind: "none",
	},
	...overrides,
});

const expiryEvent = (outgoing: TileActorItem) => ({
	type: "item:expired" as const,
	itemId: outgoing.id,
	canonicalItemId: outgoing.itemId,
	location: outgoing.location as Extract<
		TileActorItem["location"],
		{
			scope: "board";
		}
	>,
	quantity: outgoing.quantity,
});

const transition = (
	sequence: number,
	liveItems: ReadonlyArray<TileActorItem>,
	previousItems: ReadonlyArray<TileActorItem> | null = null,
	events: readTileActorTransitionFx.Result["events"] = [],
): TestTransition =>
	({
		sequence,
		previousRuntime: null,
		runtime: {},
		events,
		projected: {
			sequence,
			previousItems,
			liveItems,
			events,
		},
	}) as unknown as TestTransition;

const Capture = () => {
	captured = useTileActorTransitionSource();
	return null;
};

const renderSource = async (initial: TestTransition) => {
	let current = initial;
	let listener:
		| ((transition: CommittedTransitionSchema.Type) => void | PromiseLike<void>)
		| null = null;
	let claimedSequence = -1;
	const game = {
		getTransitionSnapshot: () => current,
		claimTilePresentationTransition: (sequence: number) => {
			if (sequence <= claimedSequence) return false;
			claimedSequence = sequence;
			return true;
		},
		subscribeTransitions: (
			next: (transition: CommittedTransitionSchema.Type) => void | PromiseLike<void>,
		) => {
			listener = next;
			void next(current);
			return () => {
				if (listener === next) listener = null;
			};
		},
		canClaimTilePresentationTransition: (sequence: number) => sequence > claimedSequence,
		readOrThrow: (effect: unknown) => effect,
	} as unknown as GameEngine;
	gameState.game = game;

	const mountSource = async () => {
		captured = null;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(createElement(Capture));
		});
		const result = captured as TileActorTransitionSource | null;
		if (result === null) throw new Error("Tile transition source was not captured.");
		return result;
	};
	const source = await mountSource();
	return {
		source,
		mountAgain: mountSource,
		emit: (next: TestTransition) => {
			current = next;
			listener?.(next);
		},
	};
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	captured = null;
	gameState.game = null;
	projectionState.includePreviousItems.length = 0;
	projectionState.failureSequence = null;
	document.body.replaceChildren();
});

describe("useTileActorTransitionSource", () => {
	it("preserves actor and array identities across semantically unchanged Tick publications", async () => {
		const first = item();
		const { source, emit } = await renderSource(
			transition(0, [
				first,
			]),
		);
		const received: readTileActorTransitionFx.Result[] = [];
		const unsubscribe = source.subscribe((next) => {
			received.push(next);
		});

		try {
			expect(projectionState.includePreviousItems).toEqual([
				false,
				false,
			]);
			projectionState.includePreviousItems.length = 0;
			expect(received[0]?.liveItems).toBe(source.initial.liveItems);
			expect(received[0]?.events).toEqual([]);
			const unchanged = item();
			emit(
				transition(
					1,
					[
						unchanged,
					],
					[
						item(),
					],
				),
			);
			expect(received[1]?.previousItems).toBe(source.initial.liveItems);
			expect(received[1]?.liveItems).toBe(source.initial.liveItems);
			expect(received[1]?.liveItems[0]).toBe(first);

			const changed = item({
				revision: "revision:water:2",
				quantity: 2,
			});
			emit(
				transition(
					2,
					[
						changed,
					],
					[
						unchanged,
					],
				),
			);
			expect(received[2]?.previousItems).toBe(received[1]?.liveItems);
			expect(received[2]?.liveItems).not.toBe(received[1]?.liveItems);
			expect(received[2]?.liveItems[0]).toBe(changed);

			emit(
				transition(
					3,
					[
						item({
							revision: "revision:water:2",
							quantity: 2,
						}),
					],
					[
						changed,
					],
				),
			);
			expect(received[3]?.liveItems).toBe(received[2]?.liveItems);
			expect(received[3]?.liveItems[0]).toBe(changed);
			expect(projectionState.includePreviousItems).toEqual([
				false,
				false,
				false,
			]);
		} finally {
			unsubscribe();
		}
	});

	it("projects an exact previous world when a sequence gap prevents live-actor reuse", async () => {
		const first = item();
		const { source, emit } = await renderSource(
			transition(0, [
				first,
			]),
		);
		const received: readTileActorTransitionFx.Result[] = [];
		const unsubscribe = source.subscribe((next) => {
			received.push(next);
		});

		try {
			projectionState.includePreviousItems.length = 0;
			const outgoing = item({
				id: "runtime:expired",
			});
			emit(
				transition(
					2,
					[],
					[
						outgoing,
					],
					[
						expiryEvent(outgoing),
					],
				),
			);

			expect(projectionState.includePreviousItems).toEqual([
				true,
			]);
			expect(received[1]?.previousItems?.[0]).toBe(outgoing);
			expect(received[1]?.events).toHaveLength(1);
		} finally {
			unsubscribe();
		}
	});

	it("does not consume a transition claim when its live projection fails", async () => {
		const outgoing = item({
			id: "runtime:expired",
		});
		const { source, emit } = await renderSource(
			transition(0, [
				outgoing,
			]),
		);
		const received: readTileActorTransitionFx.Result[] = [];
		const unsubscribe = source.subscribe((next) => {
			received.push(next);
		});
		const expired = transition(
			1,
			[],
			[
				outgoing,
			],
			[
				expiryEvent(outgoing),
			],
		);

		try {
			projectionState.failureSequence = expired.sequence;
			expect(() => emit(expired)).toThrow("Projection failed.");
			expect(received).toHaveLength(1);

			projectionState.failureSequence = null;
			emit(expired);
			expect(received).toHaveLength(2);
			expect(received[1]?.events).toHaveLength(1);
			expect(received[1]?.previousItems?.[0]).toBe(outgoing);
		} finally {
			unsubscribe();
		}
	});

	it("delivers one late current transition once and hydrates a remount without replay", async () => {
		const outgoing = item({
			id: "runtime:expired",
		});
		const expired = transition(
			1,
			[],
			[
				outgoing,
			],
			[
				expiryEvent(outgoing),
			],
		);
		const { source, mountAgain } = await renderSource(expired);

		expect(projectionState.includePreviousItems).toEqual([
			false,
		]);
		expect(source.initial.events).toEqual([]);
		expect(source.initial.previousItems).toBeNull();
		const first = source.claimCurrent();
		expect(projectionState.includePreviousItems).toEqual([
			false,
			true,
		]);
		expect(first.events).toHaveLength(1);
		expect(first.previousItems?.[0]).toBe(outgoing);

		const remounted = await mountAgain();
		expect(projectionState.includePreviousItems).toEqual([
			false,
			true,
			false,
		]);
		expect(remounted.initial.events).toEqual([]);
		expect(remounted.initial.previousItems).toBeNull();
		const replay = remounted.claimCurrent();
		expect(projectionState.includePreviousItems).toEqual([
			false,
			true,
			false,
			false,
		]);
		expect(replay.events).toEqual([]);
		expect(replay.previousItems).toBeNull();
	});

	it("refreshes projection identity for location, job status, artwork, and primary-action changes", async () => {
		const first = item();
		const { source, emit } = await renderSource(
			transition(0, [
				first,
			]),
		);
		const received: readTileActorTransitionFx.Result[] = [];
		const unsubscribe = source.subscribe((next) => {
			received.push(next);
		});

		try {
			const changed = item({
				location: {
					scope: "inventory",
					position: {
						x: 1,
						y: 0,
					},
				},
				jobStatus: "running",
				running: true,
				sourceUrl: "arkini://water-v2",
				compositeUrl: "arkini://water-composite",
				primaryAction: {
					kind: "start-default-line",
					lineId: "line:water",
				},
			});
			emit(
				transition(
					1,
					[
						changed,
					],
					[
						first,
					],
				),
			);

			expect(received[1]?.liveItems[0]).toBe(changed);
			expect(received[1]?.liveItems[0]).not.toBe(first);
		} finally {
			unsubscribe();
		}
	});

	it("does not collapse distinct non-running job statuses", async () => {
		const paused = item({
			jobStatus: "paused",
		});
		const { source, emit } = await renderSource(
			transition(0, [
				paused,
			]),
		);
		const received: readTileActorTransitionFx.Result[] = [];
		const unsubscribe = source.subscribe((next) => {
			received.push(next);
		});

		try {
			const awaitingOutput = item({
				jobStatus: "awaiting-output",
			});
			emit(
				transition(
					1,
					[
						awaitingOutput,
					],
					[
						paused,
					],
				),
			);

			expect(received[1]?.liveItems[0]).toBe(awaitingOutput);
			expect(received[1]?.liveItems[0]).not.toBe(paused);
		} finally {
			unsubscribe();
		}
	});

	it("stabilizes equal open-inventory actions and refreshes when their kind changes", async () => {
		const first = item({
			primaryAction: {
				kind: "open-inventory",
			},
		});
		const { source, emit } = await renderSource(
			transition(0, [
				first,
			]),
		);
		const received: readTileActorTransitionFx.Result[] = [];
		const unsubscribe = source.subscribe((next) => {
			received.push(next);
		});

		try {
			emit(
				transition(1, [
					item({
						primaryAction: {
							kind: "open-inventory",
						},
					}),
				]),
			);
			expect(received[1]?.liveItems[0]).toBe(first);

			const changed = item({
				primaryAction: {
					kind: "open-lines",
				},
			});
			emit(
				transition(2, [
					changed,
				]),
			);
			expect(received[2]?.liveItems[0]).toBe(changed);
			expect(received[2]?.liveItems[0]).not.toBe(first);
		} finally {
			unsubscribe();
		}
	});
});
