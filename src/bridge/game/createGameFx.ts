import { Effect } from "effect";

import type { Game } from "~/bridge/game/Game";
import { createGameSession } from "~/bridge/game/createGameSession";
import { decodeFx } from "~/engine/pack/fx/decodeFx";
import { startFx } from "~/engine/start/write/startFx";

export namespace createGameFx {
	export interface Props {
		packUrl: string;
	}
}

const readCompressedPack = (packUrl: string) =>
	Effect.tryPromise({
		try: async () => {
			const response = await fetch(packUrl);
			if (!response.ok) {
				throw new Error(
					`Unable to load game pack: ${response.status} ${response.statusText}.`,
				);
			}

			const compressed = await response.arrayBuffer();
			const stream = new Blob([
				compressed,
			])
				.stream()
				.pipeThrough(new DecompressionStream("gzip"));
			return new Uint8Array(await new Response(stream).arrayBuffer());
		},
		catch: (cause) => cause,
	});

/** Loads one packed game and returns its single live browser-owned instance. */
export const createGameFx = Effect.fn("createGameFx")(function* ({ packUrl }: createGameFx.Props) {
	const bytes = yield* readCompressedPack(packUrl);
	const payload = yield* decodeFx(bytes);
	const session = yield* Effect.tryPromise({
		try: () =>
			createGameSession({
				config: payload.config,
			}),
		catch: (cause) => cause,
	});
	const resourceUrls = new Map<string, string>();

	const revokeResources = () => {
		for (const url of resourceUrls.values()) URL.revokeObjectURL(url);
		resourceUrls.clear();
	};
	const discardFailedBootstrap = Effect.tryPromise({
		try: () => session.disposeWithoutSave(),
		catch: () => undefined,
	}).pipe(Effect.ensuring(Effect.sync(revokeResources)), Effect.ignore);

	return yield* Effect.gen(function* () {
		yield* Effect.sync(() => {
			for (const resource of payload.resources) {
				resourceUrls.set(
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
		});
		yield* Effect.tryPromise({
			try: () => session.run(startFx()),
			catch: (cause) => cause,
		});

		let disposePromise: Promise<void> | undefined;
		const dispose = () => {
			disposePromise ??= session.dispose().finally(revokeResources);
			return disposePromise;
		};
		const disposeWithoutSave = () => {
			disposePromise ??= session.disposeWithoutSave().finally(revokeResources);
			return disposePromise;
		};

		return {
			...session,
			config: payload.config,
			dispose,
			disposeWithoutSave,
			instanceKey: crypto.randomUUID(),
			getResourceUrl: (resourceId) => {
				const url = resourceUrls.get(resourceId);
				if (url === undefined)
					throw new Error(`Game resource ${resourceId} is unavailable.`);
				return url;
			},
		} satisfies Game;
	}).pipe(Effect.onError(() => discardFailedBootstrap));
});
