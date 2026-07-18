import { Effect } from "effect";

export namespace preloadLauncherHeroFx {
	export interface Props {
		readonly url: string;
	}
}

/** Loads and decodes the launcher Hero before the visible splash may reveal it. */
export const preloadLauncherHeroFx = Effect.fn("preloadLauncherHeroFx")(
	({ url }: preloadLauncherHeroFx.Props) =>
		Effect.tryPromise({
			try: async () => {
				const image = new Image();
				image.decoding = "async";
				image.src = url;
				if (!(image.complete && image.naturalWidth > 0)) {
					await new Promise<void>((resolve, reject) => {
						image.onload = () => resolve();
						image.onerror = () =>
							reject(new Error("Arkini Hero artwork failed to load."));
					});
				}
				if (image.naturalWidth <= 0) {
					throw new Error("Arkini Hero artwork failed to load.");
				}
				await image.decode();
			},
			catch: (cause) => cause,
		}),
);
