import { Effect } from "effect";

const rules = [
	{
		line: "/build/",
		variants: new Set([
			"/build/",
			"/build",
			"build/",
			"build",
		]),
	},
	{
		line: "/editor.lock",
		variants: new Set([
			"/editor.lock",
			"editor.lock",
		]),
	},
] as const;

export const addGitignoreRulesFx = Effect.fn("addGitignoreRulesFx")((source: string) => {
	const lines = source.split(/\r?\n/).map((line) => line.trim());
	const missing = rules.filter(({ variants }) => !lines.some((line) => variants.has(line)));
	return Effect.succeed(
		missing.length === 0
			? source
			: `${source}${source.length === 0 || source.endsWith("\n") ? "" : "\n"}${missing.map(({ line }) => line).join("\n")}\n`,
	);
});
