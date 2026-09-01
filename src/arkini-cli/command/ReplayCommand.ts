import { Command, Flag } from "effect/unstable/cli";
import { Clock, Console, Effect, FileSystem, Option } from "effect";
import { join } from "node:path";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";

import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import { GameIncidentFiles } from "~shared/GameIncidentMetadata";
import { decodeArkpackEnvelopeFx } from "~/arkpack-artifact/fx/decodeArkpackEnvelopeFx";
import { decodeFx } from "~/arkpack-artifact/fx/decodeFx";
import { readArkpackContentHashFx } from "~/arkpack-artifact/fx/readArkpackContentHashFx";
import { toDiagnosticValueResultFn } from "~/application-diagnostics/fn/toDiagnosticValueFn";
import { decodeArkiniSaveFx } from "~/game-persistence/fx/decodeArkiniSaveFx";
import { GAME_DIAGNOSTIC_HISTORY_LIMIT } from "~/game-incident/constant/GameDiagnosticHistoryLimit";
import { formatGameReplayTextFn } from "~/game-incident/fn/formatGameReplayTextFn";
import {
	readGameDiagnosticHistoryEntryFn,
	readGameDiagnosticRelatedItemsResultFn,
	readGameDiagnosticTransitionSignatureFn,
} from "~/game-incident/fn/readGameDiagnosticHistoryEntryFn";
import { readGameDiagnosticRuntimeFn } from "~/game-incident/fn/readGameDiagnosticRuntimeFn";
import type { GameDiagnosticHistoryEntrySchema } from "~/game-incident/schema/GameDiagnosticHistorySchema";
import type { GameDiagnosticFailure } from "~/game-incident/type/GameDiagnosticFailure";
import type { GameReplayReport } from "~/game-incident/type/GameReplayReport";
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
	const clock = yield* Clock.Clock;
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
		const initialTransition = session.getTransitionSnapshotFn();
		const initialRuntime = readGameDiagnosticRuntimeFn({
			config: payload.config,
			runtime: initialTransition.runtime,
		});
		const startedAtMs = clock.currentTimeMillisUnsafe();
		let previousObservedAtMs: number | undefined;
		let previousSignature: string | undefined;
		let observedSnapshots = 0;
		let totalHistoryEntries = 0;
		const history: GameDiagnosticHistoryEntrySchema.Type[] = [];
		const unsubscribeTransitionsFn = session.subscribeTransitionsFn((transition) => {
			observedSnapshots += 1;
			const signature = readGameDiagnosticTransitionSignatureFn(transition);
			if (signature === previousSignature && transition.events.length === 0) return;
			previousSignature = signature;
			const observedAtMs = clock.currentTimeMillisUnsafe();
			history.push(
				readGameDiagnosticHistoryEntryFn({
					config: payload.config,
					elapsedSincePreviousMs:
						previousObservedAtMs === undefined
							? null
							: Math.max(0, observedAtMs - previousObservedAtMs),
					observedAt: new Date(observedAtMs).toISOString(),
					transition,
				}),
			);
			previousObservedAtMs = observedAtMs;
			totalHistoryEntries += 1;
			if (history.length > GAME_DIAGNOSTIC_HISTORY_LIMIT) {
				history.splice(0, history.length - GAME_DIAGNOSTIC_HISTORY_LIMIT);
			}
		});
		const result = yield* waitForFatalFx(session, timeoutMs).pipe(
			Effect.ensuring(Effect.sync(unsubscribeTransitionsFn)),
		);
		const finalTransition = session.getTransitionSnapshotFn();
		const fatal = session.getFatalErrorFn();
		const capturedAtMs = clock.currentTimeMillisUnsafe();
		const error = toDiagnosticValueResultFn(fatal);
		const failure = (() => {
			if (fatal === null) return null;
			const relatedItems = readGameDiagnosticRelatedItemsResultFn({
				config: payload.config,
				transition: finalTransition,
				value: fatal,
			});
			return {
				source: fatal.source,
				sequence: finalTransition.sequence,
				observedAt: new Date(capturedAtMs).toISOString(),
				error: error.value,
				errorTruncated: error.truncated,
				relatedItems: relatedItems.items,
				relatedItemsTruncated: relatedItems.truncated,
			} satisfies GameDiagnosticFailure;
		})();
		const report = {
			applicationVersion: ArkiniAppVersion,
			packageId: payload.config.meta.id,
			contentHash,
			gameVersion: payload.version,
			elapsedMs: Math.max(0, capturedAtMs - startedAtMs),
			result,
			initialSequence: initialTransition.sequence,
			finalSequence: finalTransition.sequence,
			observedSnapshots,
			semanticTransitions: Math.max(0, totalHistoryEntries - 1),
			history: {
				retainedLimit: GAME_DIAGNOSTIC_HISTORY_LIMIT,
				totalEntries: totalHistoryEntries,
				entries: history,
			},
			failure,
			initialRuntime,
			finalRuntime: readGameDiagnosticRuntimeFn({
				config: payload.config,
				runtime: finalTransition.runtime,
			}),
		} satisfies GameReplayReport;
		yield* Console.log(formatGameReplayTextFn(report));
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
