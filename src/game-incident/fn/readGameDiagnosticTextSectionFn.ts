import { match } from "ts-pattern";
import type { GameDiagnosticTextSection } from "~/game-incident/type/GameDiagnosticTextSection";

export const readGameDiagnosticTextSectionFn = (
	value: string,
): GameDiagnosticTextSection | Error => {
	return match(value)
		.with("all", "summary", "failure", "history", "runtime", (value) => value)
		.otherwise(
			() => new Error("--section must be one of: all, summary, failure, history, runtime."),
		);
};
