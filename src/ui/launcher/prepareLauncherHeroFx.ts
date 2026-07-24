import { Effect, Exit } from "effect";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";
import { readHeroResource } from "~/bridge/arkpack/readHeroResource";
import { readLastPackageIdFx } from "~/bridge/launcher/readLastPackageIdFx";
import { preloadLauncherHeroFx } from "~/ui/launcher/preloadLauncherHeroFx";

export namespace prepareLauncherHeroFx {
	export interface Props {
		readonly fallbackUrl: string;
	}

	export interface Result {
		readonly owned: boolean;
		readonly url: string;
	}
}

/** Resolves and decodes the preferred package Hero, degrading any failure to the shell fallback. */
export const prepareLauncherHeroFx = Effect.fn("prepareLauncherHeroFx")(
	({ fallbackUrl }: prepareLauncherHeroFx.Props) =>
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
			return yield* Effect.try({
				try: () => {
					const resource = readHeroResource(loaded.payload);
					return {
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
					} satisfies prepareLauncherHeroFx.Result;
				},
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
