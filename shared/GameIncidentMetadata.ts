/** Fixed disposable files written for the most recent failed installed-game session. */
export const GameIncidentFiles = {
	directory: "latest",
	arkpack: "game.arkpack",
	save: "save.arksave",
	incident: "incident.md",
	failure: "failure.md",
	history: "history.md",
	runtimeState: "runtime-state.md",
} as const;
