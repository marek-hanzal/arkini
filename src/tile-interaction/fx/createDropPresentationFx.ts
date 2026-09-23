import { Effect } from "effect";

export interface DropPresentation {
	readonly beginFx: (sourceActorId: string) => Effect.Effect<number, never, never>;
	readonly settleFx: (generation: number) => Effect.Effect<void, never, never>;
	readonly isPendingActorFx: (actorId: string) => Effect.Effect<boolean, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}

/** Each released command keeps only its source identity until that Promise settles. */
export const createDropPresentationFx = Effect.fn("createDropPresentationFx")(() =>
	Effect.sync((): DropPresentation => {
		const pending = new Map<number, string>();
		let nextGeneration = 0;
		let closed = false;

		return {
			beginFx: Effect.fn("DropPresentation.beginFx")((sourceActorId) =>
				Effect.sync(() => {
					if (closed)
						throw new Error("Cannot begin a drop after presentation ownership closed.");
					const generation = ++nextGeneration;
					pending.set(generation, sourceActorId);
					return generation;
				}),
			),
			settleFx: Effect.fn("DropPresentation.settleFx")((generation) =>
				Effect.sync(() => {
					pending.delete(generation);
				}),
			),
			isPendingActorFx: Effect.fn("DropPresentation.isPendingActorFx")((actorId) =>
				Effect.sync(() => {
					for (const pendingActorId of pending.values()) {
						if (pendingActorId === actorId) return true;
					}
					return false;
				}),
			),
			closeFx: Effect.sync(() => {
				if (closed) return;
				closed = true;
				pending.clear();
			}),
		};
	}),
);
