import { Effect } from "effect";

export interface GameInteractionControl {
	readonly cancelFx: Effect.Effect<void, never, never>;
	readonly registerFx: (cancelFn: () => void) => Effect.Effect<() => void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}

/** Owns the route-local cancellation edge into the currently mounted main Pixi scene. */
export const createGameInteractionControlFx = Effect.fn("createGameInteractionControlFx")(() =>
	Effect.sync((): GameInteractionControl => {
		const cancellations = new Set<() => void>();
		let closed = false;
		return {
			cancelFx: Effect.sync(() => {
				for (const cancelFn of cancellations) cancelFn();
			}),
			registerFx: Effect.fn("GameInteractionControl.registerFx")((cancelFn) =>
				Effect.sync(() => {
					if (closed) return () => undefined;
					cancellations.add(cancelFn);
					return () => cancellations.delete(cancelFn);
				}),
			),
			closeFx: Effect.sync(() => {
				closed = true;
				cancellations.clear();
			}),
		};
	}),
);
