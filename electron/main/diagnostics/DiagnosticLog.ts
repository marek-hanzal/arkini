import type { Effect } from "effect";

import type { DiagnosticRecord } from "../../contract/diagnostics/DiagnosticRecord";

/** Process-owned bounded diagnostic log capability exposed to trusted renderer IPC. */
export interface DiagnosticLog {
	readonly directoryPath: string;
	readonly writeFx: (record: DiagnosticRecord) => Effect.Effect<void, unknown>;
	readonly openDirectoryFx: Effect.Effect<void, unknown>;
	readonly closeFx: Effect.Effect<void, unknown>;
}
