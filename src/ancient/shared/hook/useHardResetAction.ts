import { useCallback, useRef, useState } from "react";

export namespace useHardResetAction {
	export interface Props {
		reset(): Promise<void>;
		onSuccess(): void;
		onError(error: unknown): void;
	}

	export type Status = "idle" | "pending" | "failed" | "succeeded";
}

export const useHardResetAction = ({ reset, onSuccess, onError }: useHardResetAction.Props) => {
	const pendingRef = useRef(false);
	const [status, setStatus] = useState<useHardResetAction.Status>("idle");

	const run = useCallback(async () => {
		if (pendingRef.current) return;

		pendingRef.current = true;
		setStatus("pending");

		try {
			await reset();
			setStatus("succeeded");
			onSuccess();
		} catch (error) {
			pendingRef.current = false;
			setStatus("failed");
			onError(error);
		}
	}, [
		onError,
		onSuccess,
		reset,
	]);

	return {
		failed: status === "failed",
		pending: status === "pending",
		run,
		status,
	};
};
