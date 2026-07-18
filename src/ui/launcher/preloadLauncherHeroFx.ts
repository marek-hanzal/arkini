import { Effect } from "effect";

interface RetainedLauncherHero {
	readonly image: HTMLImageElement;
	readonly url: string;
	decoded: boolean;
	pending: Promise<void> | undefined;
}

let retainedLauncherHero: RetainedLauncherHero | undefined;

const createRetainedLauncherHero = (url: string): RetainedLauncherHero => {
	const image = new Image();
	image.decoding = "sync";
	image.fetchPriority = "high";
	image.loading = "eager";
	image.src = url;
	return {
		image,
		url,
		decoded: false,
		pending: undefined,
	};
};

const waitForLauncherHeroLoad = async (image: HTMLImageElement) => {
	if (image.complete && image.naturalWidth > 0) return;
	await new Promise<void>((resolve, reject) => {
		image.addEventListener("load", () => resolve(), {
			once: true,
		});
		image.addEventListener(
			"error",
			() => reject(new Error("Arkini Hero artwork failed to load.")),
			{
				once: true,
			},
		);
	});
};

export namespace preloadLauncherHeroFx {
	export interface Props {
		readonly url: string;
	}
}

/** Loads, decodes, and retains the launcher Hero for the complete renderer session. */
export const preloadLauncherHeroFx = Effect.fn("preloadLauncherHeroFx")(
	({ url }: preloadLauncherHeroFx.Props) =>
		Effect.tryPromise({
			try: async () => {
				const retained =
					retainedLauncherHero?.url === url
						? retainedLauncherHero
						: createRetainedLauncherHero(url);
				retainedLauncherHero = retained;
				if (retained.decoded) return;
				retained.pending ??= (async () => {
					await waitForLauncherHeroLoad(retained.image);
					if (retained.image.naturalWidth <= 0) {
						throw new Error("Arkini Hero artwork failed to load.");
					}
					await retained.image.decode();
					retained.decoded = true;
				})()
					.catch((cause) => {
						if (retainedLauncherHero === retained) retainedLauncherHero = undefined;
						throw cause;
					})
					.finally(() => {
						retained.pending = undefined;
					});
				await retained.pending;
			},
			catch: (cause) => cause,
		}),
);
