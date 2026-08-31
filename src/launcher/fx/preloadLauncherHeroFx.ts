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
			yield* Effect.callback<void, Error>((resumeFn) => {
				const onLoadFn = () => {
					image.removeEventListener("load", onLoadFn);
					image.removeEventListener("error", onErrorFn);
					resumeFn(
						image.naturalWidth > 0
							? Effect.void
							: Effect.fail(new Error("Arkini Hero artwork failed to load.")),
					);
				};
				const onErrorFn = () => {
					image.removeEventListener("load", onLoadFn);
					image.removeEventListener("error", onErrorFn);
					resumeFn(Effect.fail(new Error("Arkini Hero artwork failed to load.")));
				};
				image.addEventListener("load", onLoadFn, {
					once: true,
				});
				image.addEventListener("error", onErrorFn, {
					once: true,
				});
				image.src = url;
				if (image.complete && image.naturalWidth > 0) onLoadFn();
				return Effect.sync(() => {
					image.removeEventListener("load", onLoadFn);
					image.removeEventListener("error", onErrorFn);
				});
			});
			yield* Effect.tryPromise({
				try: (_signal) => image.decode(),
				catch: (cause) => cause,
			});
		}),
);
