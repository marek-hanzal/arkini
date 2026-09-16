import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Effect } from "effect";

const execFileAsyncFn = promisify(execFile);

const silenceThreshold = "-50dB";
const silenceDurationSeconds = 0.1;
const retainedEdgeSilenceSeconds = 0.02;

const readEdgeTrimFilterFn = ({ stderr, stdout }: { stderr: string; stdout: string }) => {
	const durationMatch = [
		...stdout.matchAll(/^out_time_us=(\d+)$/gm),
	].at(-1);
	const durationSeconds =
		durationMatch === undefined ? undefined : Number(durationMatch[1]) / 1_000_000;
	const events = [
		...stderr.matchAll(/silence_(start|end):\s*(-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)/gi),
	];
	const intervals: Array<{
		readonly end: number;
		readonly start: number;
	}> = [];
	let start: number | undefined;
	for (const event of events) {
		const seconds = Number(event[2]);
		if (!Number.isFinite(seconds)) continue;
		if (event[1] === "start") {
			start = seconds;
			continue;
		}
		if (start === undefined) continue;
		intervals.push({
			end: seconds,
			start,
		});
		start = undefined;
	}
	const leading = intervals[0]?.start <= 0.01 ? intervals[0] : undefined;
	const trailing =
		durationSeconds === undefined ||
		Math.abs((intervals.at(-1)?.end ?? 0) - durationSeconds) > 0.05
			? undefined
			: intervals.at(-1);
	const trimStartSeconds =
		leading === undefined ? 0 : Math.max(0, leading.end - retainedEdgeSilenceSeconds);
	const trimEndSeconds =
		trailing === undefined || durationSeconds === undefined
			? durationSeconds
			: Math.min(durationSeconds, trailing.start + retainedEdgeSilenceSeconds);
	if (trimEndSeconds !== undefined && trimEndSeconds <= trimStartSeconds) return undefined;
	const options = [
		...(trimStartSeconds > 0
			? [
					`start=${trimStartSeconds.toFixed(6)}`,
				]
			: []),
		...(durationSeconds !== undefined &&
		trimEndSeconds !== undefined &&
		trimEndSeconds < durationSeconds
			? [
					`end=${trimEndSeconds.toFixed(6)}`,
				]
			: []),
	];
	return options.length === 0 ? undefined : `atrim=${options.join(":")},asetpts=PTS-STARTPTS`;
};

const isMissingCommandFn = (cause: unknown) =>
	typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT";

export namespace transcodeAudioResourceFileFx {
	export interface Props {
		readonly skipWithoutEdgeTrim: boolean;
		readonly source: string;
		readonly target: string;
	}
}

/** Uses a PATH-visible FFmpeg to detect silent edges and stream one source into Ogg/Opus. */
export const transcodeAudioResourceFileFx = Effect.fn("transcodeAudioResourceFileFx")(
	({ skipWithoutEdgeTrim, source, target }: transcodeAudioResourceFileFx.Props) =>
		Effect.tryPromise({
			try: async () => {
				const analysis = await execFileAsyncFn(
					"ffmpeg",
					[
						"-nostdin",
						"-hide_banner",
						"-loglevel",
						"info",
						"-stats_period",
						"3600",
						"-i",
						source,
						"-map",
						"0:a:0",
						"-vn",
						"-af",
						`silencedetect=noise=${silenceThreshold}:d=${silenceDurationSeconds}`,
						"-progress",
						"pipe:1",
						"-nostats",
						"-f",
						"null",
						"-",
					],
					{
						encoding: "utf8",
						maxBuffer: 1024 * 1024,
						windowsHide: true,
					},
				);
				const edgeTrimFilter = readEdgeTrimFilterFn(analysis);
				if (skipWithoutEdgeTrim && edgeTrimFilter === undefined) return false;
				await execFileAsyncFn(
					"ffmpeg",
					[
						"-nostdin",
						"-hide_banner",
						"-loglevel",
						"error",
						"-y",
						"-i",
						source,
						"-map",
						"0:a:0",
						"-vn",
						"-map_metadata",
						"-1",
						...(edgeTrimFilter === undefined
							? []
							: [
									"-af",
									edgeTrimFilter,
								]),
						"-c:a",
						"libopus",
						"-ar",
						"48000",
						"-f",
						"ogg",
						target,
					],
					{
						maxBuffer: 1024 * 1024,
						windowsHide: true,
					},
				);
				return true;
			},
			catch: (cause) =>
				isMissingCommandFn(cause)
					? new Error("FFmpeg is unavailable in PATH.", {
							cause,
						})
					: new Error("FFmpeg could not process this audio file.", {
							cause,
						}),
		}),
);
