import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem } from "effect";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

import type { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { createFilesystemArkpackCatalogFx } from "~electron/main/arkpack/createFilesystemArkpackCatalogFx";
import { decodeArkpackEnvelopeFx } from "~/arkpack-artifact/fx/decodeArkpackEnvelopeFx";
import { encodeGameProjectFileStemFn } from "~/game-config-source/fn/encodeGameProjectFileStemFn";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import { createTestArkpack } from "~test/arkpack-support/fx/createTestArkpack";

export const createBundledBytes = (packageId: string) =>
	createTestArkpack(undefined, packageId, "1.0");

export const createUserBytes = (packageId: string) =>
	createTestArkpack(undefined, packageId, "1.1");

export const readRoots = (root: string) => ({
	bundled: join(root, "bundled"),
	user: join(root, "user"),
});

export const readPackageFilename = (packageId: string) =>
	`${encodeGameProjectFileStemFn(packageId)}.arkpack`;

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
	readonly source: ArkiniElectronApi.ArkpackFile["source"];
}): ArkiniElectronApi.ArkpackFile => {
	const bytes = source === "bundled" ? createBundledBytes(packageId) : createUserBytes(packageId);
	const { payload } = Effect.runSync(decodeArkpackEnvelopeFx(bytes));
	return {
		packageId,
		filename: readPackageFilename(packageId),
		contentHash: createHash("sha256").update(payload).digest("hex"),
		title: "Test game",
		version: source === "bundled" ? "1.0" : "1.1",
		arkini: ArkiniAppVersion,
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
		createFilesystemArkpackCatalogFx({
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
