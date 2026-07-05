import { match } from "ts-pattern";
import type { LineRunState } from "~/producer/view/LineRunStateTypes";

const readExecutionBlockedLineRunLabel = (facts: LineRunState.Facts) =>
	match(facts.line)
		.when(
			({ pausedAtMs }) => pausedAtMs !== undefined,
			() => "Paused",
		)
		.with(
			{
				deliveryBlocked: true,
			},
			() => "Delivery blocked",
		)
		.with(
			{
				queueBlockedReason: "delivery_blocked",
			},
			() => "Delivery blocked",
		)
		.with(
			{
				queueBlockedReason: "paused",
			},
			() => "Queue paused",
		)
		.with(
			{
				queueFull: true,
			},
			() => "Queue full",
		)
		.otherwise(() => undefined);

const readVisibilityBlockedLineRunLabel = (facts: LineRunState.Facts) =>
	match(facts.line)
		.with(
			{
				visible: false,
			},
			() => "Line hidden",
		)
		.with(
			{
				startRequirementsReady: false,
			},
			() => "Requirements missing",
		)
		.with(
			{
				effectLocked: true,
			},
			({ kind }) => (kind === "effect" ? "Active" : "Locked"),
		)
		.otherwise(() => undefined);

const readOutputBlockedLineRunLabel = (facts: LineRunState.Facts) =>
	match(facts)
		.with(
			{
				line: {
					outputLimitBlocked: true,
				},
			},
			() => "Limit reached",
		)
		.with(
			{
				outputsDisabled: true,
			},
			() => "Drops disabled",
		)
		.with(
			{
				line: {
					blocked: true,
				},
			},
			() => "Blocked by effect",
		)
		.otherwise(() => undefined);

const readInputDrivenLineRunLabel = (facts: LineRunState.Facts) =>
	match(facts)
		.with(
			{
				canRunAction: false,
			},
			() => "Missing items",
		)
		.with(
			{
				line: {
					inputsReady: true,
				},
			},
			({ line }) => (line.kind === "effect" ? "Activate" : "Start"),
		)
		.with(
			{
				line: {
					inputsAvailable: true,
				},
			},
			({ line }) => (line.kind === "effect" ? "Auto-fill & activate" : "Auto-fill & start"),
		)
		.with(
			{
				inputsPartiallyAvailable: true,
			},
			() => "Partial fill",
		)
		.otherwise(() => "Missing items");

export const readLineRunLabel = (facts: LineRunState.Facts) =>
	readExecutionBlockedLineRunLabel(facts) ??
	readVisibilityBlockedLineRunLabel(facts) ??
	readOutputBlockedLineRunLabel(facts) ??
	readInputDrivenLineRunLabel(facts);
