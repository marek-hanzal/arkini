import { Effect } from "effect";

interface ExclusiveActionOwner<Action extends string> {
	readonly claimFx: (action: Action) => Effect.Effect<boolean>;
	readonly getSnapshot: () => Action | null;
	readonly releaseFx: (action: Action) => Effect.Effect<void>;
	readonly subscribe: (listener: () => void) => () => void;
}

/** Creates one synchronous owner that admits at most one action at a time. */
export const createExclusiveActionOwnerFx = Effect.fn("createExclusiveActionOwnerFx")(
	<Action extends string>() =>
		Effect.sync(() => {
			const listeners = new Set<() => void>();
			let active: Action | null = null;

			const publish = (next: Action | null) => {
				if (active === next) return;
				active = next;
				for (const listener of Array.from(listeners)) listener();
			};

			return {
				claimFx: Effect.fn("ExclusiveActionOwner.claimFx")((action: Action) =>
					Effect.sync(() => {
						if (active !== null) return false;
						publish(action);
						return true;
					}),
				),
				getSnapshot: () => active,
				releaseFx: Effect.fn("ExclusiveActionOwner.releaseFx")((action: Action) =>
					Effect.sync(() => {
						if (active === action) publish(null);
					}),
				),
				subscribe: (listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
			} satisfies ExclusiveActionOwner<Action>;
		}),
);
