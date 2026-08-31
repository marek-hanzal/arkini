import { Cause, Option } from "effect";

/** Reads one typed failure only when the Cause has no defect, interruption, or sibling reason. */
export const readExactCauseFailureFn = <Error>(cause: Cause.Cause<Error>) => {
	if (cause.reasons.length !== 1) return Option.none<Error>();
	const reason = cause.reasons[0];
	return Cause.isFailReason(reason) ? Option.some(reason.error) : Option.none<Error>();
};
