import { mkdir, open, readFile, rename, rm, type FileHandle } from "node:fs/promises";
import { join } from "node:path";
import type { ArkiniDesktopApi } from "../../../desktop/ArkiniDesktopApi";

const hashPattern = /^[a-f0-9]{64}$/;
const packagePattern = /^(?:arkini|[a-f0-9]{64})$/;

interface FilesystemOperations {
	readonly mkdir: typeof mkdir;
	readonly open: (path: string, flags: string) => Promise<FileHandle>;
	readonly readFile: typeof readFile;
	readonly rename: typeof rename;
	readonly rm: typeof rm;
}

const filesystemOperations: FilesystemOperations = {
	mkdir,
	open,
	readFile,
	rename,
	rm,
};

const assertKey = ({ packageId, contentHash }: ArkiniDesktopApi.SaveKey) => {
	if (!packagePattern.test(packageId) || !hashPattern.test(contentHash)) {
		throw new Error("Invalid Arkini save identity.");
	}
	return {
		packageId,
		contentHash,
	} as const;
};

/** Stores opaque save bytes atomically beneath one exact package/hash key. */
export class FilesystemGameSaveRepository {
	readonly #root: string;
	readonly #filesystem: FilesystemOperations;

	constructor(userDataPath: string, filesystem: FilesystemOperations = filesystemOperations) {
		this.#root = join(userDataPath, "arkini", "saves");
		this.#filesystem = filesystem;
	}

	#directory = (key: ArkiniDesktopApi.SaveKey) => {
		const valid = assertKey(key);
		return join(this.#root, valid.packageId, valid.contentHash);
	};

	read = async (key: ArkiniDesktopApi.SaveKey): Promise<Uint8Array | null> => {
		try {
			return new Uint8Array(
				await this.#filesystem.readFile(join(this.#directory(key), "current.arksave")),
			);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
			throw error;
		}
	};

	write = async (key: ArkiniDesktopApi.SaveKey, bytes: Uint8Array): Promise<void> => {
		const directory = this.#directory(key);
		const pending = join(directory, "pending.arksave");
		const current = join(directory, "current.arksave");
		await this.#filesystem.mkdir(directory, {
			recursive: true,
		});
		const handle = await this.#filesystem.open(pending, "w");
		try {
			await handle.writeFile(bytes);
			await handle.sync();
		} finally {
			await handle.close();
		}
		try {
			await this.#filesystem.rename(pending, current);
		} finally {
			await this.#filesystem.rm(pending, {
				force: true,
			});
		}
	};

	clear = async (key: ArkiniDesktopApi.SaveKey): Promise<void> => {
		await this.#filesystem.rm(this.#directory(key), {
			recursive: true,
			force: true,
		});
	};
}
