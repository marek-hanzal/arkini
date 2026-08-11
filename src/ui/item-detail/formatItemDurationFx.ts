import { Effect } from "effect";

/** Formats an authored millisecond duration for compact item presentation. */
export const formatItemDurationFx = Effect.fn("formatItemDurationFx")((milliseconds: number) =>
	Effect.sync(() => {
		if (milliseconds === 0) return "Immediate";
		const seconds = milliseconds / 1_000;
		if (seconds < 60)
			return Number.isInteger(seconds) ? `${seconds} s` : `${seconds.toFixed(1)} s`;
		const roundedSeconds = Math.round(seconds);
		const hours = Math.floor(roundedSeconds / 3_600);
		const minutes = Math.floor((roundedSeconds % 3_600) / 60);
		const remainingSeconds = roundedSeconds % 60;
		return [
			...(hours === 0
				? []
				: [
						`${hours} h`,
					]),
			...(minutes === 0
				? []
				: [
						`${minutes} min`,
					]),
			...(remainingSeconds === 0
				? []
				: [
						`${remainingSeconds} s`,
					]),
		].join(" ");
	}),
);
