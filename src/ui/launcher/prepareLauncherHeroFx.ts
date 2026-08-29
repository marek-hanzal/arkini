import { Effect, Exit } from "effect";
import { loadArkpackFx } from "~/renderer/arkpack/loadArkpackFx";
import type { PayloadSchema } from "~/engine/pack/schema/PayloadSchema";
import { readLastPackageIdFx } from "~/renderer/launcher/readLastPackageIdFx";
import { preloadLauncherHeroFx } from "~/ui/launcher/preloadLauncherHeroFx";

interface PrepareLauncherHeroProps {
	readonly fallbackUrl: string;
}

export namespace prepareLauncherHeroFx {
	export interface Result {
		readonly owned: boolean;
		readonly url: string;
	}
}

const readHeroResourceFx = Effect.fn("prepareLauncherHeroFx.readResourceFx")(function* (
	payload: PayloadSchema.Type,
) {
	const resourceId = payload.config.resources.hero;
	const resource = payload.resources.find((candidate) => candidate.id === resourceId);
	if (resource === undefined) {
		return yield* Effect.fail(new Error(`Arkpack Hero resource ${resourceId} is unavailable.`));
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
					owned: false,
					url: fallbackUrl,
				} satisfies prepareLauncherHeroFx.Result;
			}
			const loaded = yield* loadArkpackFx({
				packageId,
			});
			const resource = yield* readHeroResourceFx(loaded.payload);
			return yield* Effect.try({
				try: () =>
					({
						owned: true,
						url: URL.createObjectURL(
							new Blob(
								[
									resource.bytes.slice().buffer,
								],
								{
									type: resource.mime,
								},
							),
						),
					}) satisfies prepareLauncherHeroFx.Result,
				catch: (cause) => cause,
			});
		}).pipe(
			Effect.flatMap((candidate) =>
				preloadLauncherHeroFx({
					url: candidate.url,
				}).pipe(
					Effect.as(candidate),
					Effect.onExit((exit) =>
						Exit.isFailure(exit) && candidate.owned
							? Effect.sync(() => URL.revokeObjectURL(candidate.url))
							: Effect.void,
					),
				),
			),
			Effect.catch(() =>
				preloadLauncherHeroFx({
					url: fallbackUrl,
				}).pipe(
					Effect.as({
						owned: false,
						url: fallbackUrl,
					} satisfies prepareLauncherHeroFx.Result),
				),
			),
		),
);
