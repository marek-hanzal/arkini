import { Effect } from "effect";
import { ArkiniDefaultPackageId } from "../../../../shared/ArkiniAppMetadata";
import { loadArkpackFx } from "~/arkpack/renderer/loadArkpackFx";
import { readAboutPortraitResourcesFn } from "~/ui/launcher/about/fn/readAboutPortraitResourcesFn";

const revokeUrls = (urls: readonly string[]) => {
	for (const url of urls) {
		try {
			URL.revokeObjectURL(url);
		} catch {
			// Every owned URL still gets one revocation attempt if another one fails.
		}
	}
};

/** Loads and scope-owns the canonical Arkini About portrait object URLs. */
export const createAboutPortraitAssetsFx = Effect.fn("createAboutPortraitAssetsFx")(() =>
	Effect.gen(function* () {
		const loaded = yield* loadArkpackFx({
			packageId: ArkiniDefaultPackageId,
		});
		const resources = readAboutPortraitResourcesFn(loaded.payload);
		return yield* Effect.acquireRelease(
			Effect.try({
				try: () => {
					const urls: string[] = [];
					try {
						for (const resource of resources) {
							urls.push(
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
							);
						}
						return urls;
					} catch (cause) {
						revokeUrls(urls);
						throw cause;
					}
				},
				catch: (cause) => cause,
			}),
			(urls) => Effect.sync(() => revokeUrls(urls)),
			{
				interruptible: true,
			},
		);
	}).pipe(Effect.catch(() => Effect.succeed([]))),
);
