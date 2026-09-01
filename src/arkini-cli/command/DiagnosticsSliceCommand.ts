import { Argument, Command, Flag } from "effect/unstable/cli";
import { Console, Effect, FileSystem, Option } from "effect";
import { join } from "node:path";

import { GameIncidentFiles } from "~shared/GameIncidentMetadata";
import { formatGameDiagnosticSessionTextFn } from "~/game-incident/fn/formatGameDiagnosticSessionTextFn";
import { readGameDiagnosticTextSectionFn } from "~/game-incident/fn/readGameDiagnosticTextSectionFn";
import { readGameDiagnosticLogSessionFx } from "~/game-incident/fx/readGameDiagnosticLogSessionFx";
import { readGameIncidentTextFx } from "~/game-incident/fx/readGameIncidentTextFx";

const runDiagnosticsSliceFx = Effect.fn("runDiagnosticsSliceFx")(function* ({
	input,
	section: requestedSection,
	sessionId,
}: {
	readonly input: string;
	readonly section: string;
	readonly sessionId: Option.Option<string>;
}) {
	const section = readGameDiagnosticTextSectionFn(requestedSection);
	if (section instanceof Error) return yield* Effect.fail(section);
	const fileSystem = yield* FileSystem.FileSystem;
	const inputInfo = yield* fileSystem
		.stat(input)
		.pipe(Effect.mapError(() => new Error("Could not inspect the diagnostic input.")));
	const fixedIncident =
		inputInfo.type === "Directory" &&
		(yield* fileSystem.exists(join(input, GameIncidentFiles.incident)));
	if (fixedIncident) {
		if (Option.isSome(sessionId)) {
			return yield* Effect.fail(
				new Error(
					"--session-id applies only to diagnostic JSONL; a fixed incident already owns one exact session.",
				),
			);
		}
		yield* Console.log(
			yield* readGameIncidentTextFx({
				input,
				section,
			}),
		);
		return;
	}
	if (section === "runtime") {
		return yield* Effect.fail(
			new Error("--section runtime is available only for fixed incidents."),
		);
	}
	const session = yield* readGameDiagnosticLogSessionFx({
		input,
		requestedSessionId: Option.getOrUndefined(sessionId),
	});
	yield* Console.log(
		formatGameDiagnosticSessionTextFn({
			section,
			session,
		}),
	);
});

/** Renders one failed game session or fixed incident bundle as diagnostic text. */
export const DiagnosticsSliceCommand = Command.make(
	"slice",
	{
		input: Argument.path("input"),
		sessionId: Flag.optional(
			Flag.string("session-id").pipe(
				Flag.withDescription(
					"Exact JSONL session ID; defaults to the latest failed session.",
				),
			),
		),
		section: Flag.string("section").pipe(
			Flag.withDefault("all"),
			Flag.withDescription("Text section: all, summary, failure, history, or runtime."),
		),
	},
	({ input, section, sessionId }) =>
		runDiagnosticsSliceFx({
			input,
			section,
			sessionId,
		}),
).pipe(
	Command.withDescription(
		"Render one failed game session from a fixed incident or rotating diagnostic logs.",
	),
);
