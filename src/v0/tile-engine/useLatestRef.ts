import { useRef } from "react";

export function useLatestRef<TValue>(value: TValue) {
	const ref = useRef(value);
	ref.current = value;
	return ref;
}
