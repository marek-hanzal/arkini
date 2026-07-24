import { Effect } from "effect";
import { match } from "ts-pattern";

import type { ArkpackTrustSchema } from "~/engine/pack/schema/ArkpackTrustSchema";
import type { BuiltInArkpack } from "~/bridge/arkpack/BuiltInArkpack";
import { BuiltInArkpacks } from "~/bridge/arkpack/BuiltInArkpacks";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { ArkiniTrustedKeys } from "~/bridge/arkpack/ArkiniTrustedKeys";
import { createArkpackStorageFx } from "~/bridge/arkpack/createArkpackStorageFx";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";

export namespace loadArkpackFx {
	export interface Props {
		packageId: string;
		storage?: ArkpackStorage;
	}
}

const fetchBuiltInBytesFx = (arkpack: BuiltInArkpack) =>
	Effect.tryPromise({
		try: async () => {
			const response = await fetch(arkpack.url);
			if (!response.ok) {
				throw new Error(
					`Unable to load bundled ${arkpack.packageId} pack: ${response.status} ${response.statusText}.`,
				);
			}
			return new Uint8Array(await response.arrayBuffer());
		},
		catch: (cause) => cause,
	});

const fetchBuiltInSignatureFx = (arkpack: BuiltInArkpack) => {
	if (arkpack.signatureUrl === undefined) return Effect.succeed(undefined);
	const signatureUrl = arkpack.signatureUrl;
	return Effect.tryPromise({
		try: async () => {
			const response = await fetch(signatureUrl);
			if (!response.ok) {
				throw new Error(
					`Unable to load bundled ${arkpack.packageId} signature: ${response.status} ${response.statusText}.`,
				);
			}
			const source = await response.text();
			try {
				return JSON.parse(source) as unknown;
			} catch {
				return source;
			}
		},
		catch: (cause) => cause,
	});
};

const hasExpectedTrust = (actual: ArkpackTrustSchema.Type, expected: ArkpackTrustSchema.Type) =>
	match([
		actual,
		expected,
	] as const)
		.with(
			[
				{
					type: "official",
				},
				{
					type: "official",
				},
			],
			([actualTrust, expectedTrust]) => actualTrust.keyId === expectedTrust.keyId,
		)
		.with(
			[
				{
					type: "external",
				},
				{
					type: "external",
				},
			],
			([actualTrust, expectedTrust]) => actualTrust.reason === expectedTrust.reason,
		)
		.with(
			[
				{
					type: "invalid",
				},
				{
					type: "invalid",
				},
			],
			([actualTrust, expectedTrust]) =>
				actualTrust.reason === expectedTrust.reason &&
				actualTrust.keyId === expectedTrust.keyId,
		)
		.otherwise(() => false);

/** Loads and revalidates a bundled or persisted package binary before game bootstrap. */
export const loadArkpackFx = Effect.fn("loadArkpackFx")(function* ({
	packageId,
	storage: providedStorage,
}: loadArkpackFx.Props) {
	const builtIn = BuiltInArkpacks.find((arkpack) => arkpack.packageId === packageId);
	if (builtIn !== undefined) {
		const expected = builtIn.descriptor;
		const loaded = yield* readArkpackFx({
			bytes: yield* fetchBuiltInBytesFx(builtIn),
			...(expected.trust.type === "official"
				? {
						expectedOfficialKeyId: expected.trust.keyId,
					}
				: {}),
			packageId,
			signature: yield* fetchBuiltInSignatureFx(builtIn),
			source: "built-in",
			trustedKeys: ArkiniTrustedKeys,
		});
		if (
			loaded.descriptor.contentHash !== expected.contentHash ||
			loaded.descriptor.gameId !== expected.gameId ||
			loaded.descriptor.title !== expected.title ||
			loaded.descriptor.configVersion !== expected.configVersion ||
			loaded.descriptor.compressedSize !== expected.compressedSize ||
			!hasExpectedTrust(loaded.descriptor.trust, expected.trust)
		) {
			return yield* Effect.fail(
				new Error(
					`Bundled ${builtIn.packageId} metadata does not match its exact package binary.`,
				),
			);
		}
		return loaded;
	}

	const storage = providedStorage ?? (yield* createArkpackStorageFx());
	return yield* Effect.gen(function* () {
		const record = yield* storage.readFx(packageId);
		if (record === undefined) {
			return yield* Effect.fail(new Error(`Arkpack ${packageId} is not installed.`));
		}
		const loaded = yield* readArkpackFx({
			bytes: new Uint8Array(record.bytes),
			filename: record.descriptor.filename,
			importedAtMs: record.descriptor.importedAtMs,
			source: "imported",
			trustedKeys: ArkiniTrustedKeys,
		});
		if (loaded.descriptor.contentHash !== packageId) {
			return yield* Effect.fail(
				new Error(`Arkpack ${packageId} failed its content hash check.`),
			);
		}
		return loaded;
	});
});
