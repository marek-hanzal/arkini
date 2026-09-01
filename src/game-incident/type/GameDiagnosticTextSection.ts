export type GameDiagnosticTextSection = "all" | "summary" | "failure" | "history" | "runtime";

export type GameDiagnosticSessionTextSection = Exclude<GameDiagnosticTextSection, "runtime">;
