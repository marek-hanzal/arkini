import { Effect } from "effect";

export interface PixiGameInteractionControl {
	readonly cancelFx: Effect.Effect<void>;
	readonly registerFx: (cancel: () => void) => Effect.Effect<() => void>;
	readonly closeFx: Effect.Effect<void>;
}

/** Owns the route-local cancellation edge into the currently mounted main Pixi scene. */
export const createPixiGameInteractionControlFx = Effect.fn("createPixiGameInteractionControlFx")(
	() =>
		Effect.sync((): PixiGameInteractionControl => {
			const cancellations = new Set<() => void>();
			let closed = false;
			return {
				cancelFx: Effect.sync(() => {
					for (const cancel of cancellations) cancel();
				}),
				registerFx: Effect.fn("PixiGameInteractionControl.registerFx")((cancel) =>
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
