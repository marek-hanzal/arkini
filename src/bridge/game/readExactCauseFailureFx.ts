import { Cause, Effect, Option } from "effect";

/**
 * Reads one typed failure only when the Cause contains no defect, interruption, or sibling reason.
 *
 * TODO(#397): Replace direct `cause.reasons` traversal with the stable supported Cause
 * projection, preserving this exact typed-failure-only contract.
 */
export const readExactCauseFailureFx = Effect.fnUntraced(function* <Error>(
	cause: Cause.Cause<Error>,
) {
	if (cause.reasons.length !== 1) return Option.none<Error>();
	const reason = cause.reasons[0];
	return Cause.isFailReason(reason) ? Option.some(reason.error) : Option.none<Error>();
});
