import { Effect } from "effect";
import { lock as acquireLock } from "proper-lockfile";

import { FilesystemWriteError } from "../FilesystemWriteError";

interface FilesystemLock {
	readonly release: () => Promise<void>;
}

const error = (lock: string, message: string, cause: unknown) =>
	new FilesystemWriteError({
		operation: "lock",
		message: `Filesystem write lock ${lock} ${message}.`,
		cause,
	});

const isAlreadyReleased = (cause: unknown) =>
	typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ERELEASED";

const acquireFx = Effect.fn("acquireFilesystemWriteLockFx")((lock: string) =>
	Effect.tryPromise({
		try: () =>
			acquireLock(lock, {
				lockfilePath: lock,
				onCompromised: (cause) => {
					throw error(lock, "was compromised", cause);
				},
				realpath: false,
				retries: {
					factor: 1,
					maxTimeout: 500,
					minTimeout: 500,
					retries: 10,
				},
				stale: 3_000,
				update: 1_000,
			}).then((release) => ({
				release,
			})),
		catch: (cause) => error(lock, "could not be acquired", cause),
	}),
);

const releaseFx = (lock: string, owner: FilesystemLock) =>
	Effect.tryPromise({
		try: () =>
			owner.release().catch((cause: unknown) => {
				if (!isAlreadyReleased(cause)) throw cause;
			}),
		catch: (cause) => error(lock, "could not be released", cause),
	});

/** Holds one portable optimistic lock around the supplied Effect. */
export const withFilesystemLockFx = <Value, Failure, Requirements>(
	lock: string,
	effect: Effect.Effect<Value, Failure, Requirements>,
) =>
	Effect.acquireUseRelease(
		acquireFx(lock),
		() => effect,
		(owner) => releaseFx(lock, owner),
	);
