import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { Effect } from "effect";

const lockOwnerScript = `
const parentPid = Number(process.argv[1]);
process.stdout.write("locked\\n");
setInterval(() => {
	try {
		process.kill(parentPid, 0);
	} catch {
		process.exit(0);
	}
}, 100);
`;

const acquireFx = Effect.fn("acquireFilesystemLockFx")((lockPath: string) =>
	Effect.tryPromise({
		try: (signal) =>
			new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
				if (process.platform !== "darwin") {
					reject(new Error("Filesystem publication locks require macOS lockf."));
					return;
				}
				const child = spawn(
					"/usr/bin/lockf",
					[
						"-k",
						"-t",
						"5",
						lockPath,
						process.execPath,
						"-e",
						lockOwnerScript,
						String(process.pid),
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
				child.once("exit", (code) => {
					rejectAcquisition(
						new Error(
							stderr.trim() || `Filesystem lock ${lockPath} exited with ${code}.`,
						),
					);
				});
				child.stdout.setEncoding("utf8");
				child.stdout.on("data", (chunk: string) => {
					if (settled) return;
					stdout += chunk;
					if (!stdout.includes("\n")) return;
					if (stdout.trim() !== "locked")
						return rejectAcquisition(
							new Error(`Filesystem lock ${lockPath} returned invalid readiness.`),
						);
					settled = true;
					signal.removeEventListener("abort", abort);
					resolve(child);
				});
			}),
		catch: (cause) => cause,
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
				child.kill("SIGTERM");
			}),
	).pipe(Effect.ignore);

/** Holds one macOS kernel lock that the OS releases when its owner process exits. */
export const withFilesystemLockFx = <Value, Error, Requirements>(
	lockPath: string,
	effect: Effect.Effect<Value, Error, Requirements>,
) => Effect.acquireUseRelease(acquireFx(lockPath), () => effect, releaseFx);
