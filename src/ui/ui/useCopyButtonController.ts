import { useLayoutEffect, useRef, useState } from "react";

export namespace useCopyButtonController {
	export interface Props {
		readonly value: string;
	}

	export interface Output {
		readonly copied: boolean;
		readonly copyFn: () => Promise<void>;
		readonly error?: string;
	}
}

/** Owns clipboard feedback for one value; obsolete writes cannot settle into a successor. */
export const useCopyButtonController = ({
	value,
}: useCopyButtonController.Props): useCopyButtonController.Output => {
	const [copied, setCopiedFn] = useState(false);
	const [error, setErrorFn] = useState<string>();
	const requestRef = useRef(0);
	const timeoutRef = useRef<number>(undefined);

	useLayoutEffect(() => {
		setCopiedFn(false);
		setErrorFn(undefined);
		return () => {
			requestRef.current += 1;
			window.clearTimeout(timeoutRef.current);
		};
	}, [
		value,
	]);

	const copyFn = async () => {
		const request = ++requestRef.current;
		window.clearTimeout(timeoutRef.current);
		setCopiedFn(false);
		setErrorFn(undefined);
		try {
			await window.serakki.clipboard.writeTextFn(value);
			if (request !== requestRef.current) return;
			setCopiedFn(true);
			timeoutRef.current = window.setTimeout(() => setCopiedFn(false), 3_000);
		} catch (cause) {
			if (request !== requestRef.current) return;
			setErrorFn(cause instanceof Error ? cause.message : String(cause));
		}
	};

	return {
		copied,
		copyFn,
		error,
	};
};
