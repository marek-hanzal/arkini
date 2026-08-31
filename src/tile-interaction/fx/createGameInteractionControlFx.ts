import { Effect } from "effect";

export interface GameInteractionControl {
	readonly cancelFx: Effect.Effect<void, never, never>;
	readonly registerFx: (cancel: () => void) => Effect.Effect<() => void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}

/** Owns the route-local cancellation edge into the currently mounted main Pixi scene. */
export const createGameInteractionControlFx = Effect.fn("createGameInteractionControlFx")(() =>
	Effect.sync((): GameInteractionControl => {
		const cancellations = new Set<() => void>();
		let closed = false;
		return {
			cancelFx: Effect.sync(() => {
				for (const cancel of cancellations) cancel();
			}),
			registerFx: Effect.fn("GameInteractionControl.registerFx")((cancel) =>
				Effect.sync(() => {
					if (closed) return () => undefined;
					cancellations.add(cancel);
					return () => cancellations.delete(cancel);
				}),
			),
			closeFx: Effect.sync(() => {
				closed = true;
				cancellations.clear();
			}),
		};
	}),
);
