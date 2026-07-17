import { Effect } from "effect";

export namespace preloadLauncherHeroFx {
	export interface Props {
		readonly url: string;
	}
}

/** Preloads the launcher Hero image before startup may become ready. */
export const preloadLauncherHeroFx = Effect.fn("preloadLauncherHeroFx")(
	({ url }: preloadLauncherHeroFx.Props) =>
		Effect.tryPromise({
			try: () =>
				new Promise<void>((resolve, reject) => {
					const image = new Image();
					image.decoding = "async";
					image.onload = () => resolve();
					image.onerror = () => reject(new Error("Arkini Hero artwork failed to load."));
					image.src = url;
					if (image.complete && image.naturalWidth > 0) resolve();
				}),
			catch: (cause) => cause,
		}),
);
