namespace GameTime {
	export interface ReadProgressProps {
		nowMs: number;
		readyAtMs: number;
		startAtMs: number;
	}

	export interface ReadRemainingMsProps {
		nowMs: number;
		readyAtMs: number;
	}

	export interface ReadFutureWakeAtMsProps {
		nowMs?: number;
		value: number;
	}

	export interface ReadMinWakeAtMsProps {
		nowMs?: number;
		values: readonly (number | undefined | null)[];
	}

	export interface IsActiveWindowProps {
		endAtMs: number;
		nowMs: number;
		startAtMs: number;
	}
}

export const readGameTimeProgress = ({ nowMs, readyAtMs, startAtMs }: GameTime.ReadProgressProps) =>
	Math.max(0, Math.min(1, (nowMs - startAtMs) / Math.max(1, readyAtMs - startAtMs)));

export const readGameTimeRemainingMs = ({ nowMs, readyAtMs }: GameTime.ReadRemainingMsProps) =>
	Math.max(0, readyAtMs - nowMs);

export const readGameTimeDurationMs = ({
	readyAtMs,
	startAtMs,
}: {
	readyAtMs: number;
	startAtMs: number;
}) => Math.max(0, readyAtMs - startAtMs);

export const isGameTimeDue = ({ nowMs, readyAtMs }: GameTime.ReadRemainingMsProps) =>
	readyAtMs <= nowMs;

export const isGameTimeWindowActive = ({
	endAtMs,
	nowMs,
	startAtMs,
}: GameTime.IsActiveWindowProps) => startAtMs <= nowMs && endAtMs > nowMs;

const readFutureGameWakeAtMs = ({ nowMs, value }: GameTime.ReadFutureWakeAtMsProps) => {
	if (nowMs === undefined) return value;
	return value > nowMs ? value : undefined;
};

export const readMinGameWakeAtMs = ({ nowMs, values }: GameTime.ReadMinWakeAtMsProps) => {
	const wakeTimes = values
		.map((value) =>
			value === undefined || value === null
				? undefined
				: readFutureGameWakeAtMs({
						nowMs,
						value,
					}),
		)
		.filter((value): value is number => value !== undefined);

	return wakeTimes.length > 0 ? Math.min(...wakeTimes) : null;
};
