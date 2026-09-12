import { useEffect, useState } from "react";

/** Settles typed searches after a pause; initial queries and clearing stay immediate. */
export const useDebouncedSearchQuery = (query: string): string => {
	const [settledQuery, setSettledQueryFn] = useState(query);
	useEffect(() => {
		if (query === "") {
			setSettledQueryFn("");
			return;
		}
		const timeout = setTimeout(() => setSettledQueryFn(query), 250);
		return () => clearTimeout(timeout);
	}, [
		query,
	]);
	return query === "" ? "" : settledQuery;
};
