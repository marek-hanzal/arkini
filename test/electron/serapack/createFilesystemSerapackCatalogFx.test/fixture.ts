import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem } from "effect";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

import type { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import { createFilesystemSerapackCatalogFx } from "~electron/main/serapack/createFilesystemSerapackCatalogFx";
import { decodeTestSerapackEnvelopeFx } from "~test/serapack-support/fx/testSerapackCodecFx";
import { encodeGameProjectFileStemFn } from "~/game-config-source/fn/encodeGameProjectFileStemFn";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import { createTestSerapack } from "~test/serapack-support/fx/createTestSerapack";

export const createBundledBytes = (packageId: string) =>
	createTestSerapack(undefined, packageId, "1.0");

export const createUserBytes = (packageId: string) =>
	createTestSerapack(undefined, packageId, "1.1");

export const readRoots = (root: string) => ({
	bundled: join(root, "bundled"),
	user: join(root, "user"),
});

export const readPackageFilename = (packageId: string) =>
	`${encodeGameProjectFileStemFn(packageId)}.serapack`;

export const readPackagePath = (root: string, packageId: string) =>
	join(root, readPackageFilename(packageId));

export const writePackage = async ({
	bytes,
	packageId,
	root,
}: {
	readonly bytes: Uint8Array;
	readonly packageId: string;
	readonly root: string;
}) => {
	await mkdir(root, {
		recursive: true,
	});
	const path = readPackagePath(root, packageId);
	await writeFile(path, bytes);
	return path;
};

export const readFileRecord = ({
	overridesBundled = false,
	packageId,
	source,
}: {
	readonly overridesBundled?: boolean;
	readonly packageId: string;
	readonly source: SerakkiElectronApi.SerapackFile["source"];
}): SerakkiElectronApi.SerapackFile => {
	const bytes = source === "bundled" ? createBundledBytes(packageId) : createUserBytes(packageId);
	const { payload } = Effect.runSync(decodeTestSerapackEnvelopeFx(bytes));
	return {
		packageId,
		filename: readPackageFilename(packageId),
		contentHash: createHash("sha256").update(payload).digest("hex"),
		title: "Test game",
		version: source === "bundled" ? "1.0" : "1.1",
		serakki: SerakkiAppVersion,
		projectRevision: 1,
		provenance: {
			type: "community",
		},
		source,
		overridesBundled,
	};
};

export const createCatalog = (
	root: string,
	fileSystem?: FileSystem.FileSystem,
	maxCatalogBytes?: number,
) => {
	const roots = readRoots(root);
	return Effect.runPromise(
		createFilesystemSerapackCatalogFx({
			bundledRoot: roots.bundled,
			maxCatalogBytes,
			userRoot: roots.user,
			fileSystem,
		}).pipe(Effect.provide(NodeServices.layer)),
	);
};

export const createNodeFileSystem = () =>
	Effect.runPromise(FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)));

export const createPromiseGate = () => {
	let resolve!: () => void;
	const promise = new Promise<void>((complete) => {
		resolve = complete;
	});
	return {
		promise,
		resolve,
	};
};
