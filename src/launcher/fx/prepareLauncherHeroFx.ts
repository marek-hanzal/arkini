import { Effect } from "effect";
import { loadSerapackFx } from "~/serapack-catalog/fx/loadSerapackFx";
import { readLastPackageIdFx } from "~/installed-game/fx/readLastPackageIdFx";
import { preloadLauncherHeroFx } from "~/launcher/fx/preloadLauncherHeroFx";
import type { LoadedSerapackResource } from "~/serapack-catalog/fx/readSerapackCandidatesFx";

interface PrepareLauncherHeroProps {
	readonly fallbackUrl: string;
}

interface PreparedLauncherHero {
	readonly url: string;
}

const readHeroResourceFx = Effect.fn("prepareLauncherHeroFx.readResourceFx")(function* (payload: {
	readonly config: {
		readonly resources: Readonly<Record<string, string>>;
	};
	readonly resources: ReadonlyArray<LoadedSerapackResource>;
}) {
	const resourceId = payload.config.resources.hero;
	const resource = payload.resources.find((candidate) => candidate.id === resourceId);
	if (resource === undefined) {
		return yield* Effect.fail(
			new Error(`Serapack Hero resource ${resourceId} is unavailable.`),
		);
	}
	return resource;
});

/** Resolves and decodes the preferred package Hero, degrading any failure to the shell fallback. */
export const prepareLauncherHeroFx = Effect.fn("prepareLauncherHeroFx")(
	({ fallbackUrl }: PrepareLauncherHeroProps) =>
		Effect.gen(function* () {
			const packageId = yield* readLastPackageIdFx();
			if (packageId === null) {
				return {
					url: fallbackUrl,
				} satisfies PreparedLauncherHero;
			}
			const loaded = yield* loadSerapackFx({
				packageId,
			});
			const resource = yield* readHeroResourceFx(loaded.payload);
			return {
				url: resource.url,
			} satisfies PreparedLauncherHero;
		}).pipe(
			Effect.flatMap((candidate) =>
				preloadLauncherHeroFx({
					url: candidate.url,
				}).pipe(Effect.as(candidate)),
			),
			Effect.catch(() =>
				preloadLauncherHeroFx({
					url: fallbackUrl,
				}).pipe(
					Effect.as({
						url: fallbackUrl,
					} satisfies PreparedLauncherHero),
				),
			),
		),
);
