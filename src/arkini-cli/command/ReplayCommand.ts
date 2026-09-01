import { Command, Flag } from "effect/unstable/cli";
import { Console, Effect, FileSystem, Option } from "effect";
import { join } from "node:path";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";

import { GameIncidentFiles } from "~shared/GameIncidentMetadata";
import { decodeArkpackEnvelopeFx } from "~/arkpack-artifact/fx/decodeArkpackEnvelopeFx";
import { decodeFx } from "~/arkpack-artifact/fx/decodeFx";
import { readArkpackContentHashFx } from "~/arkpack-artifact/fx/readArkpackContentHashFx";
import { toDiagnosticValueFn } from "~/application-diagnostics/fn/toDiagnosticValueFn";
import { decodeArkiniSaveFx } from "~/game-persistence/fx/decodeArkiniSaveFx";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { createGameSessionFx } from "~/game-session/fx/createGameSessionFx";
import type { GameSession } from "~/game-session/type/GameSession";
import { readMajorFn as readGameVersionMajorFn } from "~/game-version/fn/readMajorFn";

interface ReplayPaths {
	readonly arkpack: string;
	readonly save: string;
}

const gunzipAsyncFn = promisify(gunzip);

const resolveReplayPathsFn = ({
	arkpack,
	incident,
	save,
}: {
	readonly arkpack: Option.Option<string>;
	readonly incident: Option.Option<string>;
	readonly save: Option.Option<string>;
}): ReplayPaths | Error => {
	if (Option.isSome(incident) && Option.isNone(arkpack) && Option.isNone(save)) {
		return {
			arkpack: join(incident.value, GameIncidentFiles.arkpack),
			save: join(incident.value, GameIncidentFiles.save),
		};
	}
	if (Option.isNone(incident) && Option.isSome(arkpack) && Option.isSome(save)) {
		return {
			arkpack: arkpack.value,
			save: save.value,
		};
	}
	return new Error(
		"Use either --incident <directory> or both --arkpack <file> and --save <file>.",
	);
};

const waitForFatalFx = (session: GameSession, timeoutMs: number) =>
	Effect.callback<"fatal" | "timeout">((resume) => {
		let settled = false;
		let timeout: ReturnType<typeof setTimeout> | undefined;
		let unsubscribeFn: () => void = () => undefined;
		const settleFn = (result: "fatal" | "timeout") => {
			if (settled) return;
			settled = true;
			unsubscribeFn();
			if (timeout !== undefined) clearTimeout(timeout);
			resume(Effect.succeed(result));
		};
		unsubscribeFn = session.subscribeFatalErrorFn(() => settleFn("fatal"));
		timeout = setTimeout(() => settleFn("timeout"), timeoutMs);
		if (session.getFatalErrorFn() !== null) settleFn("fatal");
		return Effect.sync(() => {
			settled = true;
			unsubscribeFn();
			if (timeout !== undefined) clearTimeout(timeout);
		});
	});

const runReplayFx = Effect.fn("runReplayFx")(function* ({
	arkpack: arkpackOption,
	incident,
	save: saveOption,
	timeoutMs,
	untilFatal,
}: {
	readonly arkpack: Option.Option<string>;
	readonly incident: Option.Option<string>;
	readonly save: Option.Option<string>;
	readonly timeoutMs: number;
	readonly untilFatal: boolean;
}) {
	if (!untilFatal) {
		return yield* Effect.fail(new Error("Replay requires the explicit --until-fatal mode."));
	}
	if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) {
		return yield* Effect.fail(new Error("--timeout-ms must be between 1 and 300000."));
	}
	const paths = resolveReplayPathsFn({
		arkpack: arkpackOption,
		incident,
		save: saveOption,
	});
	if (paths instanceof Error) return yield* Effect.fail(paths);
	const fileSystem = yield* FileSystem.FileSystem;
	const arkpackBytes = new Uint8Array(yield* fileSystem.readFile(paths.arkpack));
	const envelope = yield* decodeArkpackEnvelopeFx(arkpackBytes);
	const payload = yield* decodeFx(
		yield* Effect.tryPromise({
			try: async () => new Uint8Array(await gunzipAsyncFn(envelope.payload)),
			catch: (cause) => cause,
		}),
	);
	const contentHash = yield* readArkpackContentHashFx(arkpackBytes);
	const saved = yield* decodeArkiniSaveFx(yield* fileSystem.readFile(paths.save));
	const arkpackVersion = readGameVersionMajorFn(payload.version);
	const saveVersion = readGameVersionMajorFn(saved.version);
	if (saveVersion.major !== arkpackVersion.major) {
		return yield* Effect.fail(
			new Error(
				`Save version ${saved.version} is incompatible with arkpack version ${payload.version}.`,
			),
		);
	}
	const session = yield* createGameSessionFx({
		config: payload.config,
		state: saved.state,
	});
	return yield* Effect.gen(function* () {
		let transitions = 0;
		let lastSequence = session.getTransitionSnapshotFn().sequence;
		const unsubscribeTransitionsFn = session.subscribeTransitionsFn((transition) => {
			transitions += 1;
			lastSequence = transition.sequence;
		});
		const startedAt = Date.now();
		const status = yield* waitForFatalFx(session, timeoutMs).pipe(
			Effect.ensuring(Effect.sync(unsubscribeTransitionsFn)),
		);
		const transition = session.getTransitionSnapshotFn();
		const fatal = session.getFatalErrorFn();
		yield* Console.log(
			JSON.stringify({
				status,
				packageId: payload.config.meta.id,
				contentHash,
				elapsedMs: Date.now() - startedAt,
				transitions,
				sequence: lastSequence,
				...(fatal === null
					? {}
					: {
							source: fatal.source,
							error: toDiagnosticValueFn(fatal),
						}),
				lastCommitted: toDiagnosticValueFn(
					{
						sequence: transition.sequence,
						events: transition.events,
						state: fromRuntimeFn({
							runtime: transition.runtime,
						}),
					},
					14 * 1_024,
				),
			}),
		);
	}).pipe(
		Effect.ensuring(session.disposeWithoutSaveFx.pipe(Effect.catchCause(() => Effect.void))),
	);
});

/** Replays an exact Arkpack/save pair through the production GameSession without persistence. */
export const ReplayCommand = Command.make(
	"replay",
	{
		incident: Flag.optional(
			Flag.directory("incident").pipe(
				Flag.withDescription(
					"Latest incident directory containing game.arkpack and save.arksave.",
				),
			),
		),
		arkpack: Flag.optional(
			Flag.file("arkpack").pipe(Flag.withDescription("Exact Arkpack to replay.")),
		),
		save: Flag.optional(Flag.file("save").pipe(Flag.withDescription("Exact save to replay."))),
		untilFatal: Flag.boolean("until-fatal").pipe(
			Flag.withDescription("Run until the session fails or the bounded timeout expires."),
		),
		timeoutMs: Flag.integer("timeout-ms").pipe(
			Flag.withDefault(10_000),
			Flag.withDescription("Maximum replay duration in milliseconds."),
		),
	},
	({ arkpack, incident, save, timeoutMs, untilFatal }) =>
		runReplayFx({
			arkpack,
			incident,
			save,
			timeoutMs,
			untilFatal,
		}),
).pipe(
	Command.withDescription(
		"Replay a failed environment through the production game loop without reading or writing installed saves.",
	),
);
