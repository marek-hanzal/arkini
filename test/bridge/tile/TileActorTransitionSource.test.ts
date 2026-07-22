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

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => {
		if (gameState.game === null) throw new Error("Missing test Game Engine.");
		return gameState.game;
	},
}));

vi.mock("~/bridge/tile/readTileActorTransitionFx", () => ({
	readTileActorTransitionFx: ({ transition }: { readonly transition: TestTransition }) =>
		transition.projected,
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
		position: { x: 0, y: 0 },
	},
	running: false,
	primaryAction: { kind: "none" },
	...overrides,
});

const transition = (
	sequence: number,
	liveItems: ReadonlyArray<TileActorItem>,
	previousItems: ReadonlyArray<TileActorItem> | null = null,
): TestTransition =>
	({
		sequence,
		previousRuntime: null,
		runtime: {},
		events: [],
		projected: {
			sequence,
			previousItems,
			liveItems,
			events: [],
		},
	}) as unknown as TestTransition;

const Capture = () => {
	captured = useTileActorTransitionSource();
	return null;
};

const renderSource = async (initial: TestTransition) => {
	let current = initial;
	let listener: ((transition: CommittedTransitionSchema.Type) => void | PromiseLike<void>) | null =
		null;
	const game = {
		getTransitionSnapshot: () => current,
		subscribeTransitions: (
			next: (transition: CommittedTransitionSchema.Type) => void | PromiseLike<void>,
		) => {
			listener = next;
			void next(current);
			return () => {
				if (listener === next) listener = null;
			};
		},
		readOrThrow: (effect: unknown) => effect,
	} as unknown as GameEngine;
	gameState.game = game;

	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(createElement(Capture));
	});
	if (captured === null) throw new Error("Tile transition source was not captured.");
	const source = captured;
	return {
		source,
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
	document.body.replaceChildren();
});

describe("useTileActorTransitionSource", () => {
	it("preserves actor and array identities across semantically unchanged Tick publications", async () => {
		const first = item();
		const { source, emit } = await renderSource(transition(0, [first]));
		const received: readTileActorTransitionFx.Result[] = [];
		const unsubscribe = source.subscribe((next) => {
			received.push(next);
		});

		try {
			expect(received[0]).toBe(source.initial);
			const unchanged = item();
			emit(transition(1, [unchanged], [item()]));
			expect(received[1]?.previousItems).toBe(source.initial.liveItems);
			expect(received[1]?.liveItems).toBe(source.initial.liveItems);
			expect(received[1]?.liveItems[0]).toBe(first);

			const changed = item({
				revision: "revision:water:2",
				quantity: 2,
			});
			emit(transition(2, [changed], [unchanged]));
			expect(received[2]?.previousItems).toBe(received[1]?.liveItems);
			expect(received[2]?.liveItems).not.toBe(received[1]?.liveItems);
			expect(received[2]?.liveItems[0]).toBe(changed);

			emit(
				transition(3, [item({ revision: "revision:water:2", quantity: 2 })], [changed]),
			);
			expect(received[3]?.liveItems).toBe(received[2]?.liveItems);
			expect(received[3]?.liveItems[0]).toBe(changed);
		} finally {
			unsubscribe();
		}
	});

	it("refreshes projection identity for location, running, artwork, and primary-action changes", async () => {
		const first = item();
		const { source, emit } = await renderSource(transition(0, [first]));
		const received: readTileActorTransitionFx.Result[] = [];
		const unsubscribe = source.subscribe((next) => {
			received.push(next);
		});

		try {
			const changed = item({
				location: {
					scope: "inventory",
					position: { x: 1, y: 0 },
				},
				running: true,
				sourceUrl: "arkini://water-v2",
				compositeUrl: "arkini://water-composite",
				primaryAction: {
					kind: "start-default-line",
					lineId: "line:water",
				},
			});
			emit(transition(1, [changed], [first]));

			expect(received[1]?.liveItems[0]).toBe(changed);
			expect(received[1]?.liveItems[0]).not.toBe(first);
		} finally {
			unsubscribe();
		}
	});
});
