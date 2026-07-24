import { Cause } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

/**
 * Projects only a settled typed failure into UI state.
 * Defects and interruption are lifecycle failures and must reach the nearest error boundary.
 *
 * TODO(#397): Adopt stable AsyncResult/Cause projection APIs without converting defects,
 * interruption, waiting failures, or composite causes into ordinary UI errors.
 */
export const readSettledAsyncResultError = <Value, Error>(
	result: AsyncResult.AsyncResult<Value, Error>,
): Error | undefined => {
	if (!AsyncResult.isFailure(result) || result.waiting) return undefined;
	if (result.cause.reasons.length !== 1) throw result.cause;
	const reason = result.cause.reasons[0];
	if (!Cause.isFailReason(reason)) throw result.cause;
	return reason.error;
};
