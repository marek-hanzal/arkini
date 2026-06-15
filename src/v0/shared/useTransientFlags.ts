import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const defaultDurationMs = 650;

export function useTransientFlags(durationMs = defaultDurationMs) {
	const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
	const [flags, setFlags] = useState<ReadonlySet<string>>(() => new Set());

	useEffect(
		() => () => {
			for (const timer of timersRef.current.values()) clearTimeout(timer);
			timersRef.current.clear();
		},
		[],
	);

	const pulse = useCallback(
		(key: string) => {
			const existing = timersRef.current.get(key);
			if (existing) clearTimeout(existing);

			setFlags((current) => {
				const next = new Set(current);
				next.add(key);
				return next;
			});

			const timer = setTimeout(() => {
				timersRef.current.delete(key);
				setFlags((current) => {
					if (!current.has(key)) return current;
					const next = new Set(current);
					next.delete(key);
					return next;
				});
			}, durationMs);
			timersRef.current.set(key, timer);
		},
		[
			durationMs,
		],
	);

	return useMemo(
		() => ({
			flags,
			pulse,
			has: (key: string) => flags.has(key),
		}),
		[
			flags,
			pulse,
		],
	);
}
