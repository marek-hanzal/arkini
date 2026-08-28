import { Effect } from "effect";
import { Assets, type Texture } from "pixi.js";

export interface TextureStore {
	readonly loadFx: (url: string) => Effect.Effect<Texture, unknown>;
	readonly closeFx: Effect.Effect<void, unknown>;
}

/** Retains package textures across both canvases and unloads them at the route boundary. */
export const createTextureStoreFx = Effect.fn("createTextureStoreFx")(() =>
	Effect.sync((): TextureStore => {
		const urls = new Set<string>();
		let closed = false;
		return {
			loadFx: (url) =>
				Effect.tryPromise({
					try: () => {
						if (closed)
							return Promise.reject(new Error("Pixi texture store is closed."));
						urls.add(url);
						return Assets.load<Texture>({
							parser: "texture",
							src: url,
						});
					},
					catch: (cause) => cause,
				}),
			closeFx: Effect.tryPromise({
				try: async () => {
					if (closed) return;
					closed = true;
					const retainedUrls = Array.from(urls);
					urls.clear();
					await Promise.all(retainedUrls.map((url) => Assets.unload(url)));
				},
				catch: (cause) => cause,
			}),
		};
	}),
);
