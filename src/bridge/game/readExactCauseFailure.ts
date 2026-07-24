import { Cause, Option } from "effect";

/**
 * Reads one typed failure only when the Cause contains no defect, interruption, or sibling reason.
 *
 * TODO(#397): Replace direct `cause.reasons` traversal with the stable supported Cause
 * projection, preserving this exact typed-failure-only contract.
 */
export const readExactCauseFailure = <Error>(cause: Cause.Cause<Error>): Option.Option<Error> => {
	if (cause.reasons.length !== 1) return Option.none();
	const reason = cause.reasons[0];
	return Cause.isFailReason(reason) ? Option.some(reason.error) : Option.none();
};
