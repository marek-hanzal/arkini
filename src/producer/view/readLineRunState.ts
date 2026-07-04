import { match } from "ts-pattern";
import { readActivationInputViewFillableQuantity } from "~/board/view/readActivationInputViewFillableQuantity";
import type { LineView } from "~/board/view/LineViewSchema";

export namespace readLineRunState {
	export interface Props {
		line: LineView;
	}

	export interface Result {
		canRunAction: boolean;
		inputsPartiallyAvailable: boolean;
		inputAvailabilityLabel?: string;
		label: string;
		progressLabel?: string;
		showProgress: boolean;
		statusMetaLabel?: string;
	}
}

type LineRunFacts = {
	canRunAction: boolean;
	inputsPartiallyAvailable: boolean;
	line: LineView;
	outputsDisabled: boolean;
	queueBlocked: boolean;
};

const readInputsPartiallyAvailable = (line: LineView) =>
	!line.inputsReady &&
	line.inputs.some((input) => readActivationInputViewFillableQuantity(input) > 0);

const readOutputsDisabled = (line: LineView) => {
	const outputs = line.outputs ?? [];
	return outputs.length > 0 && outputs.every((output) => output.enabled === false);
};

const readLineRunFacts = ({ line }: { line: LineView }): LineRunFacts => {
	const inputsPartiallyAvailable = readInputsPartiallyAvailable(line);
	const outputsDisabled = readOutputsDisabled(line);
	const queueBlocked = line.queueBlockedReason !== undefined;
	return {
		canRunAction:
			(line.inputsReady || line.inputsAvailable || inputsPartiallyAvailable) &&
			line.pausedAtMs === undefined &&
			!line.deliveryBlocked &&
			!queueBlocked &&
			line.visible !== false &&
			line.startRequirementsReady !== false &&
			!line.effectLocked &&
			!line.outputLimitBlocked &&
			!outputsDisabled &&
			!line.blocked &&
			!line.queueFull,
		inputsPartiallyAvailable,
		line,
		outputsDisabled,
		queueBlocked,
	};
};

const readLineActionVerb = ({ line }: { line: LineView }) =>
	line.kind === "effect" ? "activate" : "run";

const readInputAvailabilityLabel = ({
	inputsPartiallyAvailable,
	line,
	outputsDisabled,
}: LineRunFacts) => {
	if (line.visible === false) return "line hidden";
	if (line.startRequirementsReady === false) return "requirements missing";
	if (outputsDisabled) return "drops disabled";

	const actionLabel = readLineActionVerb({
		line,
	});
	if (line.inputItemIds.length === 0) return `tap to ${actionLabel}`;
	if (line.inputsReady) return "input ready";
	if (line.inputsAvailable) return "auto-fill ready";
	if (inputsPartiallyAvailable) return "partial fill ready";
	return "missing items";
};

const readDeliveryStatusMetaLabel = ({ line }: LineRunFacts) =>
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

const readVisibilityStatusMetaLabel = ({ line }: LineRunFacts) =>
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

const readOutputStatusMetaLabel = ({ line, outputsDisabled }: LineRunFacts) =>
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

const readStatusMetaLabel = (facts: LineRunFacts) =>
	readDeliveryStatusMetaLabel(facts) ??
	readVisibilityStatusMetaLabel(facts) ??
	readOutputStatusMetaLabel(facts);

const readProgressLabel = ({ line }: { line: LineView }) =>
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

const readExecutionBlockedLineRunLabel = (facts: LineRunFacts) =>
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

const readVisibilityBlockedLineRunLabel = (facts: LineRunFacts) =>
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

const readOutputBlockedLineRunLabel = (facts: LineRunFacts) =>
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

const readInputDrivenLineRunLabel = (facts: LineRunFacts) =>
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

const readLineRunLabel = (facts: LineRunFacts) =>
	readExecutionBlockedLineRunLabel(facts) ??
	readVisibilityBlockedLineRunLabel(facts) ??
	readOutputBlockedLineRunLabel(facts) ??
	readInputDrivenLineRunLabel(facts);

const createLineRunState = (facts: LineRunFacts): readLineRunState.Result => ({
	canRunAction: facts.canRunAction,
	inputsPartiallyAvailable: facts.inputsPartiallyAvailable,
	inputAvailabilityLabel: readInputAvailabilityLabel(facts),
	label: readLineRunLabel(facts),
	progressLabel: readProgressLabel({
		line: facts.line,
	}),
	showProgress: facts.line.inProgress && !facts.line.deliveryBlocked,
	statusMetaLabel: readStatusMetaLabel(facts),
});

export const readLineRunState = ({ line }: readLineRunState.Props): readLineRunState.Result =>
	createLineRunState(
		readLineRunFacts({
			line,
		}),
	);
