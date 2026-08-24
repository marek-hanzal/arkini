import type { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";

/** Runs one synchronous editor-project mutation inside an immediate SQLite transaction. */
export const runSqliteEditorProjectTransactionFx = Effect.fn("runSqliteEditorProjectTransactionFx")(
	<Value>(database: DatabaseSync, run: () => Value) =>
		Effect.try({
			try: () => {
				database.exec("BEGIN IMMEDIATE");
				try {
					const value = run();
					database.exec("COMMIT");
					return value;
				} catch (cause) {
					try {
						database.exec("ROLLBACK");
					} catch {
						// Preserve the operation failure that caused the rollback.
					}
					throw cause;
				}
			},
			catch: (cause) => cause,
		}),
);
