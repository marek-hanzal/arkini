import { Effect } from "effect";

const formatSecondsPart = (seconds: number) =>
	seconds.toLocaleString("en-US", {
		maximumFractionDigits: 3,
		useGrouping: false,
	});

/** Formats finite seconds using the editor's compact duration grammar. */
export const formatEditorDurationFx = Effect.fn("formatEditorDurationFx")((seconds: number) =>
	Effect.sync(() => {
		if (!Number.isFinite(seconds)) return undefined;

		const sign = seconds < 0 ? "-" : "";
		let remainingSeconds = Math.abs(seconds);
		const days = Math.floor(remainingSeconds / 86_400);
		remainingSeconds -= days * 86_400;
		const hours = Math.floor(remainingSeconds / 3_600);
		remainingSeconds -= hours * 3_600;
		const minutes = Math.floor(remainingSeconds / 60);
		remainingSeconds -= minutes * 60;

		const parts = [
			days === 0 ? undefined : `${days}d`,
			hours === 0 ? undefined : `${hours}h`,
			minutes === 0 ? undefined : `${minutes}m`,
			remainingSeconds === 0 && (days !== 0 || hours !== 0 || minutes !== 0)
				? undefined
				: `${formatSecondsPart(remainingSeconds)}s`,
		].filter((part): part is string => part !== undefined);

		return `${sign}${parts.join(" ")}`;
	}),
);
