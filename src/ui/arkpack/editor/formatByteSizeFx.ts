import { Effect } from "effect";

const units = [
	"bytes",
	"KB",
	"MB",
	"GB",
	"TB",
] as const;

const valueFormatter = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 1,
});

/** Formats an exact byte length for compact editor presentation. */
export const formatByteSizeFx = Effect.fn("formatByteSizeFx")((bytes: number) =>
	Effect.sync((): string => {
		if (bytes < 1_000) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
		const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1_000)), units.length - 1);
		return `${valueFormatter.format(bytes / 1_000 ** unitIndex)} ${units[unitIndex]}`;
	}),
);
