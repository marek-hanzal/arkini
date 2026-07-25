import { Clock, Effect } from "effect";

import type { TileSceneHandoff } from "~/ui/pixi/handoff/TileSceneHandoff";

export interface TileSceneHandoffStore {
	readonly writeFx: (itemId: string, handoff: TileSceneHandoff) => Effect.Effect<void>;
	readonly takeFx: (itemId: string) => Effect.Effect<TileSceneHandoff | null>;
	readonly closeFx: Effect.Effect<void>;
}

const handoffLifetimeMs = 2_000;

/** Owns one route-local, consume-once bridge between independent Pixi canvases. */
export const createTileSceneHandoffStoreFx = Effect.fn("createTileSceneHandoffStoreFx")(() =>
	Effect.sync((): TileSceneHandoffStore => {
		const handoffs = new Map<
			string,
			{
				readonly createdAtMs: number;
				readonly handoff: TileSceneHandoff;
			}
		>();
		let closed = false;
		return {
			writeFx: Effect.fn("TileSceneHandoffStore.writeFx")((itemId, handoff) =>
				Effect.gen(function* () {
					if (closed) return;
					handoffs.set(itemId, {
						createdAtMs: yield* Clock.currentTimeMillis,
						handoff,
					});
				}),
			),
			takeFx: Effect.fn("TileSceneHandoffStore.takeFx")((itemId) =>
				Effect.gen(function* () {
					if (closed) return null;
					const entry = handoffs.get(itemId) ?? null;
					handoffs.delete(itemId);
					if (
						entry === null ||
						(yield* Clock.currentTimeMillis) - entry.createdAtMs > handoffLifetimeMs
					) {
						return null;
					}
					return entry.handoff;
				}),
			),
			closeFx: Effect.sync(() => {
				closed = true;
				handoffs.clear();
			}),
		};
	}),
);
