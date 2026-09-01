import type { GameDiagnosticTextSection } from "~/game-incident/type/GameDiagnosticTextSection";

export const readGameDiagnosticTextSectionFn = (
	value: string,
): GameDiagnosticTextSection | Error => {
	switch (value) {
		case "all":
		case "summary":
		case "failure":
		case "history":
		case "runtime":
			return value;
		default:
			return new Error("--section must be one of: all, summary, failure, history, runtime.");
	}
};
