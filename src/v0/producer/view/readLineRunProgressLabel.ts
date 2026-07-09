import { match } from "ts-pattern";
import type { LineView } from "~/board/view/LineViewSchema";

export const readLineRunProgressLabel = ({ line }: { line: LineView }) =>
	match(line)
		.when(
			({ pausedAtMs }) => pausedAtMs !== undefined,
			() => "Paused",
		)
		.with(
			{
				kind: "effect",
			},
			() => "Active",
		)
		.otherwise(() => "Running");
