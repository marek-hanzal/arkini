import { Effect } from "effect";

interface PreloadLauncherHeroProps {
	readonly url: string;
}

/** Loads and decodes one launcher Hero with interruptible DOM listener cleanup. */
export const preloadLauncherHeroFx = Effect.fn("preloadLauncherHeroFx")(
	({ url }: PreloadLauncherHeroProps) =>
		Effect.gen(function* () {
			const image = yield* Effect.sync(() => {
				const next = new Image();
				next.decoding = "sync";
				next.fetchPriority = "high";
				next.loading = "eager";
				return next;
			});
			yield* Effect.callback<void, Error>((resume) => {
				const onLoad = () => {
					image.removeEventListener("load", onLoad);
					image.removeEventListener("error", onError);
					resume(
						image.naturalWidth > 0
							? Effect.void
							: Effect.fail(new Error("Arkini Hero artwork failed to load.")),
					);
				};
				const onError = () => {
					image.removeEventListener("load", onLoad);
					image.removeEventListener("error", onError);
					resume(Effect.fail(new Error("Arkini Hero artwork failed to load.")));
				};
				image.addEventListener("load", onLoad, {
					once: true,
				});
				image.addEventListener("error", onError, {
					once: true,
				});
				image.src = url;
				if (image.complete && image.naturalWidth > 0) onLoad();
				return Effect.sync(() => {
					image.removeEventListener("load", onLoad);
					image.removeEventListener("error", onError);
				});
			});
			yield* Effect.tryPromise({
				try: (_signal) => image.decode(),
				catch: (cause) => cause,
			});
		}),
);
