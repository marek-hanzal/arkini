import { match } from "ts-pattern";
import type { LineRunState } from "~/producer/view/LineRunStateTypes";

const readDeliveryStatusMetaLabel = ({ line }: LineRunState.Facts) =>
	match(line)
		.with(
			{
				deliveryBlocked: true,
			},
			() => "delivery blocked",
		)
		.with(
			{
				queueBlockedReason: "delivery_blocked",
			},
			() => "delivery blocked",
		)
		.with(
			{
				queueBlockedReason: "paused",
			},
			() => "queue paused",
		)
		.when(
			({ pausedAtMs }) => pausedAtMs !== undefined,
			() => "paused",
		)
		.with(
			{
				queueFull: true,
			},
			() => "queue full",
		)
		.otherwise(() => undefined);

const readVisibilityStatusMetaLabel = ({ line }: LineRunState.Facts) =>
	match(line)
		.with(
			{
				visible: false,
			},
			() => "line hidden",
		)
		.with(
			{
				startRequirementsReady: false,
			},
			() => "requirements missing",
		)
		.with(
			{
				effectLocked: true,
			},
			({ kind }) => (kind === "effect" ? "effect active" : "locked"),
		)
		.otherwise(() => undefined);

const readOutputStatusMetaLabel = ({ line, outputsDisabled }: LineRunState.Facts) =>
	match({
		line,
		outputsDisabled,
	})
		.with(
			{
				line: {
					outputLimitBlocked: true,
				},
			},
			() => "limit reached",
		)
		.with(
			{
				outputsDisabled: true,
			},
			() => "drops disabled",
		)
		.with(
			{
				line: {
					blocked: true,
				},
			},
			() => "blocked by effect",
		)
		.otherwise(() => undefined);

export const readLineRunStatusMetaLabel = (facts: LineRunState.Facts) =>
	readDeliveryStatusMetaLabel(facts) ??
	readVisibilityStatusMetaLabel(facts) ??
	readOutputStatusMetaLabel(facts);
