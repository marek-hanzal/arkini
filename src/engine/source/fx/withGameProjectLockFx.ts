import { randomUUID } from "node:crypto";
import { open, readFile, rm } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { z } from "zod";

const lockSchema = z
	.object({
		token: z.string().min(1),
		hostname: z.string().min(1),
		pid: z.number().int().positive(),
		createdAtMs: z.number().int().nonnegative(),
	})
	.strict();

const isExistingFileError = (cause: unknown) =>
	typeof cause === "object" && cause !== null && "code" in cause && cause.code === "EEXIST";

const isLiveProcess = (pid: number) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch (cause) {
		return !(
			typeof cause === "object" &&
			cause !== null &&
			"code" in cause &&
			cause.code === "ESRCH"
		);
	}
};

const parseLock = (source: string) => {
	try {
		return lockSchema.safeParse(JSON.parse(source));
	} catch {
		return undefined;
	}
};

const acquireLockFx = Effect.fn("acquireGameProjectLockFx")(function* (root: string) {
	const lockPath = join(root, "editor.lock");
	const token = randomUUID();
	for (let attempt = 0; attempt < 100; attempt += 1) {
		const acquired = yield* Effect.tryPromise({
			try: async () => {
				const handle = await open(lockPath, "wx");
				try {
					await handle.writeFile(
						`${JSON.stringify({
							token,
							hostname: hostname(),
							pid: process.pid,
							createdAtMs: Date.now(),
						})}\n`,
					);
				} finally {
					await handle.close();
				}
				return true;
			},
			catch: (cause) => cause,
		}).pipe(
			Effect.catch((cause) =>
				isExistingFileError(cause) ? Effect.succeed(false) : Effect.fail(cause),
			),
		);
		if (acquired)
			return {
				lockPath,
				token,
			};

		const existing = yield* Effect.tryPromise({
			try: () => readFile(lockPath, "utf8"),
			catch: (cause) => cause,
		}).pipe(Effect.option);
		if (existing._tag === "Some") {
			const parsed = parseLock(existing.value);
			if (
				parsed?.success &&
				parsed.data.hostname === hostname() &&
				!isLiveProcess(parsed.data.pid)
			) {
				yield* Effect.tryPromise({
					try: () =>
						rm(lockPath, {
							force: true,
						}),
					catch: (cause) => cause,
				});
				continue;
			}
		}
		yield* Effect.sleep("50 millis");
	}
	return yield* Effect.fail(
		new Error(
			`Game project ${root} is locked by another process. If that process is gone, remove editor.lock and retry.`,
		),
	);
});

const releaseLockFx = ({
	lockPath,
	token,
}: {
	readonly lockPath: string;
	readonly token: string;
}) =>
	Effect.tryPromise({
		try: async () => {
			const candidate = parseLock(await readFile(lockPath, "utf8"));
			if (candidate?.success && candidate.data.token === token)
				await rm(lockPath, {
					force: true,
				});
		},
		catch: () => undefined,
	}).pipe(Effect.ignore);

/** Serializes one cross-process project scope through its short-lived lock file. */
export const withGameProjectLockFx = <Value, Error, Requirements>(
	root: string,
	effect: Effect.Effect<Value, Error, Requirements>,
) => Effect.acquireUseRelease(acquireLockFx(root), () => effect, releaseLockFx);
