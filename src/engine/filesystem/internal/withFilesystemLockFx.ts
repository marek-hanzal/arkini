import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { Effect } from "effect";

import { FilesystemWriteError } from "../FilesystemWriteError";

const lockOwnerScript = `printf 'locked\\n'; read _`;

const acquireFx = Effect.fn("acquireFilesystemWriteLockFx")((lock: string) =>
	Effect.tryPromise({
		try: (signal) =>
			new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
				if (process.platform !== "darwin") {
					reject(new Error("FilesystemWrite locks require macOS lockf."));
					return;
				}
				const child = spawn(
					"/usr/bin/lockf",
					[
						"-k",
						"-t",
						"5",
						lock,
						"/bin/sh",
						"-c",
						lockOwnerScript,
					],
					{
						stdio: [
							"pipe",
							"pipe",
							"pipe",
						],
					},
				);
				let settled = false;
				let stderr = "";
				let stdout = "";
				const rejectAcquisition = (cause: unknown) => {
					if (settled) return;
					settled = true;
					signal.removeEventListener("abort", abort);
					child.stdin.end();
					child.kill("SIGTERM");
					reject(cause);
				};
				const abort = () => rejectAcquisition(signal.reason);
				signal.addEventListener("abort", abort, {
					once: true,
				});
				child.stderr.setEncoding("utf8");
				child.stderr.on("data", (chunk: string) => (stderr += chunk));
				child.once("error", rejectAcquisition);
				child.once("exit", (code) =>
					rejectAcquisition(
						new Error(
							stderr.trim() || `Filesystem write lock ${lock} exited with ${code}.`,
						),
					),
				);
				child.stdout.setEncoding("utf8");
				child.stdout.on("data", (chunk: string) => {
					if (settled) return;
					stdout += chunk;
					if (!stdout.includes("\n")) return;
					if (stdout.trim() !== "locked")
						return rejectAcquisition(
							new Error(`Filesystem write lock ${lock} returned invalid readiness.`),
						);
					settled = true;
					signal.removeEventListener("abort", abort);
					resolve(child);
				});
			}),
		catch: (cause) =>
			new FilesystemWriteError({
				operation: "lock",
				message: `Filesystem write lock ${lock} could not be acquired.`,
				cause,
			}),
	}),
);

const releaseFx = (child: ChildProcessWithoutNullStreams) =>
	Effect.promise(
		() =>
			new Promise<void>((resolve) => {
				if (child.exitCode !== null || child.signalCode !== null) {
					resolve();
					return;
				}
				child.once("exit", () => resolve());
				child.stdin.end();
			}),
	).pipe(Effect.ignore);

/** Holds one crash-released cross-process lock around the supplied Effect. */
export const withFilesystemLockFx = <Value, Failure, Requirements>(
	lock: string,
	effect: Effect.Effect<Value, Failure, Requirements>,
) => Effect.acquireUseRelease(acquireFx(lock), () => effect, releaseFx);
