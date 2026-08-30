import { Effect } from "effect";
import { ArkiniDefaultPackageId } from "../../../shared/ArkiniAppMetadata";
import type { PayloadSchema } from "~/arkpack/artifact/schema/PayloadSchema";
import { loadArkpackFx } from "~/arkpack/renderer/loadArkpackFx";

const avatarRoles = [
	"avatar-01",
	"avatar-02",
	"avatar-03",
	"avatar-04",
	"avatar-05",
	"avatar-06",
	"avatar-07",
] as const;

const readAboutPortraitResourcesFn = (payload: PayloadSchema.Type) => {
	const resourceById = new Map(
		payload.resources.map((resource) => [
			resource.id,
			resource,
		]),
	);
	return avatarRoles.flatMap((role) => {
		const resourceId = payload.config.resources[role];
		if (resourceId === undefined) return [];
		const resource = resourceById.get(resourceId);
		return resource === undefined
			? []
			: [
					resource,
				];
	});
};

const revokeUrlsFx = Effect.fn("createAboutPortraitAssetsFx.revokeUrlsFx")(function* (
	urls: readonly string[],
) {
	for (const url of urls) {
		yield* Effect.try({
			try: () => URL.revokeObjectURL(url),
			catch: (cause) => cause,
		}).pipe(Effect.catch(() => Effect.void));
	}
});

/** Loads and scope-owns the canonical Arkini About portrait object URLs. */
export const createAboutPortraitAssetsFx = Effect.fn("createAboutPortraitAssetsFx")(() =>
	Effect.gen(function* () {
		const loaded = yield* loadArkpackFx({
			packageId: ArkiniDefaultPackageId,
		});
		const resources = readAboutPortraitResourcesFn(loaded.payload);
		const urls: string[] = [];
		return yield* Effect.acquireRelease(
			Effect.gen(function* () {
				for (const resource of resources) {
					urls.push(
						yield* Effect.try({
							try: () =>
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
							catch: (cause) => cause,
						}),
					);
				}
				return urls;
			}).pipe(Effect.tapError(() => revokeUrlsFx(urls))),
			revokeUrlsFx,
			{
				interruptible: true,
			},
		);
	}).pipe(Effect.catch(() => Effect.succeed([]))),
);
