import type { LineRunState } from "~/producer/view/LineRunStateTypes";
import { createLineRunState } from "~/producer/view/createLineRunState";
import { readLineRunFacts } from "~/producer/view/readLineRunFacts";

export namespace readLineRunState {
	export type Props = LineRunState.Props;
	export type Result = LineRunState.Result;
}

export const readLineRunState = ({ line }: readLineRunState.Props): readLineRunState.Result =>
	createLineRunState(
		readLineRunFacts({
			line,
		}),
	);
