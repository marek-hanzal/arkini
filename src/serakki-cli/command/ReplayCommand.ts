import { CliError, Command, Flag } from "effect/unstable/cli";
import { Clock, Console, Effect, FileSystem, Option } from "effect";
import { join } from "node:path";

import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import { GameIncidentFiles } from "~shared/GameIncidentMetadata";
import { readSerapackFileConfigFx } from "~/serapack-artifact/fx/readSerapackFileConfigFx";
import { readSerapackFileLayoutFx } from "~/serapack-artifact/fx/readSerapackFileLayoutFx";
import { toDiagnosticValueResultFn } from "~/application-diagnostics/fn/toDiagnosticValueFn";
import { decodeSerakkiSaveFx } from "~/game-persistence/fx/decodeSerakkiSaveFx";
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
	readonly serapack: string;
	readonly save: string;
}

const toReplayUserErrorFn = (cause: unknown) =>
	new CliError.UserError({
		cause,
		userMessage: cause instanceof Error ? cause.message : "The replay command failed.",
	});

const resolveReplayPathsFn = ({
	serapack,
	incident,
	save,
}: {
	readonly serapack: Option.Option<string>;
	readonly incident: Option.Option<string>;
	readonly save: Option.Option<string>;
}): ReplayPaths | Error => {
	if (Option.isSome(incident) && Option.isNone(serapack) && Option.isNone(save)) {
		return {
			serapack: join(incident.value, GameIncidentFiles.serapack),
			save: join(incident.value, GameIncidentFiles.save),
		};
	}
	if (Option.isNone(incident) && Option.isSome(serapack) && Option.isSome(save)) {
		return {
			serapack: serapack.value,
			save: save.value,
		};
	}
	return new Error(
		"Use either --incident <directory> or both --serapack <file> and --save <file>.",
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
	serapack: serapackOption,
	incident,
	save: saveOption,
	timeoutMs,
	untilFatal,
}: {
	readonly serapack: Option.Option<string>;
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
		serapack: serapackOption,
		incident,
		save: saveOption,
	});
	if (paths instanceof Error) return yield* Effect.fail(paths);
	const fileSystem = yield* FileSystem.FileSystem;
	const clock = yield* Clock.Clock;
	const layout = yield* readSerapackFileLayoutFx(paths.serapack).pipe(
		Effect.mapError(() => new Error("Could not read the replay Serapack.")),
	);
	const config = yield* readSerapackFileConfigFx(layout);
	const version = layout.manifest.version;
	const contentHash = layout.contentHash;
	const saveBytes = yield* fileSystem
		.readFile(paths.save)
		.pipe(Effect.mapError(() => new Error("Could not read the replay save.")));
	const saved = yield* decodeSerakkiSaveFx(saveBytes);
	const serapackVersion = readGameVersionMajorFn(version);
	const saveVersion = readGameVersionMajorFn(saved.version);
	if (saveVersion.major !== serapackVersion.major) {
		return yield* Effect.fail(
			new Error(
				`Save version ${saved.version} is incompatible with serapack version ${version}.`,
			),
		);
	}
	const session = yield* createGameSessionFx({
		config,
		state: saved.state,
	});
	return yield* Effect.gen(function* () {
		const initialTransition = session.getTransitionSnapshotFn();
		const initialRuntime = readGameDiagnosticRuntimeFn({
			config,
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
					config,
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
				config,
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
			applicationVersion: SerakkiAppVersion,
			packageId: config.meta.id,
			contentHash,
			gameVersion: version,
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
				config,
				runtime: finalTransition.runtime,
			}),
		} satisfies GameReplayReport;
		yield* Console.log(formatGameReplayTextFn(report));
	}).pipe(
		Effect.ensuring(session.disposeWithoutSaveFx.pipe(Effect.catchCause(() => Effect.void))),
	);
});

/** Replays an exact Serapack/save pair through the production GameSession without persistence. */
export const ReplayCommand = Command.make(
	"replay",
	{
		incident: Flag.optional(
			Flag.Directory("incident").pipe(
				Flag.withDescription(
					"Latest incident directory containing game.serapack and save.serasave.",
				),
			),
		),
		serapack: Flag.optional(
			Flag.File("serapack").pipe(Flag.withDescription("Exact Serapack to replay.")),
		),
		save: Flag.optional(Flag.File("save").pipe(Flag.withDescription("Exact save to replay."))),
		untilFatal: Flag.Boolean("until-fatal").pipe(
			Flag.withDescription("Run until the session fails or the bounded timeout expires."),
		),
		timeoutMs: Flag.Int("timeout-ms").pipe(
			Flag.withDefault(10_000),
			Flag.withDescription("Maximum replay duration in milliseconds."),
		),
	},
	({ serapack, incident, save, timeoutMs, untilFatal }) =>
		runReplayFx({
			serapack,
			incident,
			save,
			timeoutMs,
			untilFatal,
		}).pipe(Effect.mapError(toReplayUserErrorFn)),
).pipe(
	Command.withDescription(
		"Replay a failed environment through the production game loop without reading or writing installed saves.",
	),
);
