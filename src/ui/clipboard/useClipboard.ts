import { useCallback, useMemo, useState } from "react";

export const useClipboard = () => {
	const [copied, setCopied] = useState<string>();
	const [error, setError] = useState<string>();
	const copy = useCallback(async (key: string, value: string) => {
		setCopied(undefined);
		setError(undefined);
		try {
			await window.arkini.clipboard.writeText(value);
			setCopied(key);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		}
	}, []);

	return useMemo(
		() => ({
			copied,
			error,
			copy,
		}),
		[
			copied,
			error,
			copy,
		],
	);
};
