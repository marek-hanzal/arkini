import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, open, readFile, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import type { ArkiniDesktopApi } from "../../../desktop/ArkiniDesktopApi";

const hashPattern = /^[a-f0-9]{64}$/;

const assertPackageId = (packageId: string) => {
	if (!hashPattern.test(packageId)) throw new Error("Invalid imported Arkpack package identity.");
	return packageId;
};

const writeSyncedFile = async (path: string, bytes: Uint8Array | string) => {
	const handle = await open(path, "w");
	try {
		await handle.writeFile(bytes);
		await handle.sync();
	} finally {
		await handle.close();
	}
};

const parseDescriptor = (
	value: unknown,
	expectedPackageId?: string,
): ArkiniDesktopApi.ArkpackDescriptor => {
	if (typeof value !== "object" || value === null) throw new Error("Invalid Arkpack metadata.");
	const descriptor = value as Partial<ArkiniDesktopApi.ArkpackDescriptor>;
	assertPackageId(descriptor.packageId ?? "");
	if (
		(expectedPackageId !== undefined && descriptor.packageId !== expectedPackageId) ||
		descriptor.contentHash !== descriptor.packageId ||
		typeof descriptor.gameId !== "string" ||
		typeof descriptor.title !== "string" ||
		typeof descriptor.configVersion !== "string" ||
		typeof descriptor.compressedSize !== "number" ||
		descriptor.source !== "imported"
	) {
		throw new Error("Invalid Arkpack metadata.");
	}
	return descriptor as ArkiniDesktopApi.ArkpackDescriptor;
};

/** Owns installed external Arkpack files beneath one Electron userData namespace. */
export class FilesystemArkpackCatalog {
	readonly #root: string;

	constructor(userDataPath: string) {
		this.#root = join(userDataPath, "arkini", "arkpacks");
	}

	list = async (): Promise<ReadonlyArray<ArkiniDesktopApi.ArkpackDescriptor>> => {
		await mkdir(this.#root, {
			recursive: true,
		});
		const entries = await readdir(this.#root, {
			withFileTypes: true,
		});
		const descriptors: ArkiniDesktopApi.ArkpackDescriptor[] = [];
		for (const entry of entries) {
			if (!entry.isDirectory() || !hashPattern.test(entry.name)) continue;
			try {
				const metadata = JSON.parse(
					await readFile(join(this.#root, entry.name, "descriptor.json"), "utf8"),
				);
				descriptors.push(parseDescriptor(metadata, entry.name));
			} catch {
				// One incomplete/corrupt install is omitted without touching healthy packages.
			}
		}
		return descriptors.sort(
			(left, right) =>
				(right.importedAtMs ?? 0) - (left.importedAtMs ?? 0) ||
				left.packageId.localeCompare(right.packageId),
		);
	};

	read = async (packageId: string): Promise<ArkiniDesktopApi.ArkpackRecord | null> => {
		const id = assertPackageId(packageId);
		const directory = join(this.#root, id);
		try {
			await access(directory);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
			throw error;
		}
		const [metadata, bytes] = await Promise.all([
			readFile(join(directory, "descriptor.json"), "utf8"),
			readFile(join(directory, "package.arkpack")),
		]);
		return {
			descriptor: parseDescriptor(JSON.parse(metadata), id),
			bytes: new Uint8Array(bytes),
		};
	};

	install = async ({ descriptor, bytes }: ArkiniDesktopApi.ArkpackRecord): Promise<void> => {
		const id = assertPackageId(descriptor.packageId);
		const parsed = parseDescriptor(descriptor, id);
		const actualHash = createHash("sha256").update(bytes).digest("hex");
		if (actualHash !== id) {
			throw new Error("Arkpack binary does not match its SHA-256 package identity.");
		}
		if (parsed.compressedSize !== bytes.byteLength) {
			throw new Error("Arkpack metadata size does not match its binary payload.");
		}
		await mkdir(this.#root, {
			recursive: true,
		});
		const finalDirectory = join(this.#root, id);
		try {
			const installed = await this.read(id);
			if (installed !== null) {
				if (createHash("sha256").update(installed.bytes).digest("hex") === id) return;
				await rm(finalDirectory, {
					recursive: true,
					force: true,
				});
			}
		} catch {
			await rm(finalDirectory, {
				recursive: true,
				force: true,
			});
		}

		const temporaryDirectory = join(this.#root, `.${id}.${randomUUID()}.pending`);
		await mkdir(temporaryDirectory);
		try {
			await writeSyncedFile(join(temporaryDirectory, "package.arkpack"), bytes);
			await writeSyncedFile(
				join(temporaryDirectory, "descriptor.json"),
				JSON.stringify(parsed),
			);
			await rename(temporaryDirectory, finalDirectory);
		} finally {
			await rm(temporaryDirectory, {
				recursive: true,
				force: true,
			});
		}
	};

	remove = async (packageId: string): Promise<void> => {
		await rm(join(this.#root, assertPackageId(packageId)), {
			recursive: true,
			force: true,
		});
	};
}
