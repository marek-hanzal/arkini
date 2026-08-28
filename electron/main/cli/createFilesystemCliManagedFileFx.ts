import { constants } from "node:fs";
import {
	access,
	chmod,
	link,
	lstat,
	mkdir,
	mkdtemp,
	open,
	readFile,
	rename,
	rm,
	unlink,
	writeFile,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { Effect } from "effect";

export type FilesystemCliManagedFileInspection =
	| {
			readonly type: "missing" | "installed" | "repairable";
	  }
	| {
			readonly type: "conflict";
			readonly message: string;
			readonly replaceable: boolean;
	  };

const isMissing = (cause: unknown) =>
	typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT";

export namespace createFilesystemCliManagedFileFx {
	export interface Props {
		readonly path: string;
		readonly managedPrefix: string;
		readonly mode: number;
		readonly subject: string;
		readonly readExpectedContents: () => Promise<string>;
		readonly executable?: boolean;
	}
}

/** Owns the race-safe filesystem mechanics shared by Arkini-managed CLI artifacts. */
export const createFilesystemCliManagedFileFx = Effect.fn("createFilesystemCliManagedFileFx")(
	function* ({
		path,
		managedPrefix,
		mode,
		subject,
		readExpectedContents,
		executable = false,
	}: createFilesystemCliManagedFileFx.Props) {
		const assertManagedHandle = async (handle: Awaited<ReturnType<typeof open>>) => {
			const opened = await handle.stat();
			const contents = await handle.readFile("utf8");
			if (!opened.isFile() || !contents.startsWith(managedPrefix)) {
				throw new Error(`${subject} at ${path} is no longer managed by Arkini.`);
			}
			return opened;
		};

		const inspect = async (): Promise<FilesystemCliManagedFileInspection> => {
			let file;
			try {
				file = await lstat(path);
			} catch (cause) {
				if (isMissing(cause)) {
					return {
						type: "missing",
					};
				}
				throw cause;
			}
			if (!file.isFile()) {
				const replaceable = file.isSymbolicLink();
				return {
					type: "conflict",
					message: replaceable
						? `Another file already exists at ${path}.`
						: `A non-file path already exists at ${path} and cannot be replaced.`,
					replaceable,
				};
			}
			const existingContents = await readFile(path, "utf8");
			if (existingContents === (await readExpectedContents())) {
				if (!executable) {
					return {
						type: "installed",
					};
				}
				try {
					await access(path, constants.X_OK);
					return {
						type: "installed",
					};
				} catch {
					return {
						type: "repairable",
					};
				}
			}
			if (existingContents.startsWith(managedPrefix)) {
				return {
					type: "repairable",
				};
			}
			return {
				type: "conflict",
				message: `Another file already exists at ${path}.`,
				replaceable: true,
			};
		};

		const repair = async () => {
			const handle = await open(path, constants.O_RDWR | constants.O_NOFOLLOW);
			try {
				await assertManagedHandle(handle);
				await handle.truncate(0);
				await handle.write(await readExpectedContents(), 0, "utf8");
				if (executable) await handle.chmod(mode);
			} finally {
				await handle.close();
			}
		};

		const publish = async (replaceExisting: boolean) => {
			const directory = dirname(path);
			await mkdir(directory, {
				recursive: true,
			});
			const temporaryDirectory = await mkdtemp(join(directory, ".arkini-cli-"));
			const temporaryPath = join(temporaryDirectory, basename(path));
			try {
				await writeFile(temporaryPath, await readExpectedContents(), {
					encoding: "utf8",
					flag: "wx",
					mode,
				});
				if (executable) await chmod(temporaryPath, mode);
				if (replaceExisting) {
					await rename(temporaryPath, path);
				} else {
					await link(temporaryPath, path);
				}
			} finally {
				await rm(temporaryDirectory, {
					recursive: true,
					force: true,
				});
			}
		};

		const remove = async () => {
			const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
			try {
				const opened = await assertManagedHandle(handle);
				const directory = dirname(path);
				const claimDirectory = await mkdtemp(join(directory, ".arkini-cli-removal-"));
				const claimedPath = join(claimDirectory, basename(path));
				try {
					await rename(path, claimedPath);
				} catch (cause) {
					await rm(claimDirectory, {
						recursive: true,
						force: true,
					});
					throw cause;
				}
				const claimed = await lstat(claimedPath);
				if (claimed.dev !== opened.dev || claimed.ino !== opened.ino) {
					throw new Error(
						`${subject} changed during removal. The unexpected file was preserved at ${claimedPath}.`,
					);
				}
				await unlink(claimedPath);
				await rm(claimDirectory, {
					recursive: true,
					force: true,
				});
			} finally {
				await handle.close();
			}
		};

		return {
			inspect,
			publish,
			remove,
			repair,
		} as const;
	},
);
