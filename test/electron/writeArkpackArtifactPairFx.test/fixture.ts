import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem } from "effect";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createFilesystemArkpackCatalogFx } from "../../../electron/main/arkpack/createFilesystemArkpackCatalogFx";
import { encodeGameProjectFileStem } from "~/engine/source/encodeGameProjectFileStem";

export const bundledBytes = Uint8Array.of(1, 2, 3);
export const userBytes = Uint8Array.of(4, 5, 6);

export const readRoots = (root: string) => ({
	bundled: join(root, "bundled"),
	user: join(root, "user"),
});

export const readPackagePath = (root: string, packageId: string) =>
	join(root, `${encodeGameProjectFileStem(packageId)}.arkpack`);

export const readSignaturePath = (root: string, packageId: string) =>
	join(root, `${encodeGameProjectFileStem(packageId)}.arksig`);

export const writePackage = async ({
	bytes,
	packageId,
	root,
	signature,
}: {
	readonly bytes: Uint8Array;
	readonly packageId: string;
	readonly root: string;
	readonly signature?: string;
}) => {
	await mkdir(root, {
		recursive: true,
	});
	const path = readPackagePath(root, packageId);
	await writeFile(path, bytes);
	if (signature !== undefined) await writeFile(readSignaturePath(root, packageId), signature);
	return path;
};

export const createCatalog = (root: string, fileSystem?: FileSystem.FileSystem) => {
	const roots = readRoots(root);
	return Effect.runPromise(
		createFilesystemArkpackCatalogFx({
			bundledRoot: roots.bundled,
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
