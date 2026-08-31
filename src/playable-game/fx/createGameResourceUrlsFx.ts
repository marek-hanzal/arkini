import { Effect, Exit, Scope } from "effect";

import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";

export namespace createGameResourceUrlsFx {
	export interface Props {
		readonly owner: string;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
	}
}

export interface GameResourceUrls {
	readonly get: (resourceId: string) => string;
	readonly releaseFx: Effect.Effect<void, never, never>;
}

/** Owns immutable object URLs for one exact live game's resource revision. */
export const createGameResourceUrlsFx = Effect.fn("createGameResourceUrlsFx")(function* ({
	owner,
	resources,
}: createGameResourceUrlsFx.Props) {
	const urls = new Map<string, string>();
	const scope = yield* Scope.make();
	yield* Scope.addFinalizer(
		scope,
		Effect.sync(() => {
			for (const url of urls.values()) URL.revokeObjectURL(url);
			urls.clear();
		}),
	);
	const releaseFx = Scope.close(scope, Exit.void);
	return yield* Effect.sync((): GameResourceUrls => {
		for (const resource of resources) {
			urls.set(
				resource.id,
				URL.createObjectURL(
					new Blob(
						[
							resource.bytes.slice().buffer,
						],
						{
							type: resource.mime,
						},
					),
				),
			);
		}
		return {
			get: (resourceId: string) => {
				const url = urls.get(resourceId);
				if (url === undefined)
					throw new Error(`${owner} resource ${resourceId} is unavailable.`);
				return url;
			},
			releaseFx,
		};
	}).pipe(Effect.onError(() => releaseFx));
});
