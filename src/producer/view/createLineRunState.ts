import type { LineRunState } from "~/producer/view/LineRunStateTypes";
import { readLineRunInputAvailabilityLabel } from "~/producer/view/readLineRunInputAvailabilityLabel";
import { readLineRunLabel } from "~/producer/view/readLineRunLabel";
import { readLineRunProgressLabel } from "~/producer/view/readLineRunProgressLabel";
import { readLineRunStatusMetaLabel } from "~/producer/view/readLineRunStatusMetaLabel";

export const createLineRunState = (facts: LineRunState.Facts): LineRunState.Result => ({
	canRunAction: facts.canRunAction,
	inputsPartiallyAvailable: facts.inputsPartiallyAvailable,
	inputAvailabilityLabel: readLineRunInputAvailabilityLabel(facts),
	label: readLineRunLabel(facts),
	progressLabel: readLineRunProgressLabel({
		line: facts.line,
	}),
	showProgress: facts.line.inProgress && !facts.line.deliveryBlocked,
	statusMetaLabel: readLineRunStatusMetaLabel(facts),
});
