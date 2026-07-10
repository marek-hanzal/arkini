import { useMutation } from "@tanstack/react-query";
import { Effect } from "effect";
import {
	createContext,
	type FC,
	type PropsWithChildren,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import type { ResourceSchema } from "~/v1/pack/schema/ResourceSchema";
import { readGamePackFx } from "~/v1/pack/fx/readGamePackFx";
import type { GameSchema } from "~/v1/schema/GameSchema";

export interface DevGamePackContextValue {
	config: GameSchema.Type | null;
	resources: ReadonlyArray<ResourceSchema.Type>;
	resourceUrlById: ReadonlyMap<string, string>;
	fileName: string | null;
	fileSize: number | null;
	isLoading: boolean;
	error: Error | null;
	load: (file: File) => Promise<void>;
	reset: () => void;
}

export const DevGamePackContext = createContext<DevGamePackContextValue | null>(null);

export namespace DevGamePackProvider {
	export interface Props extends PropsWithChildren {}
}

export const DevGamePackProvider: FC<DevGamePackProvider.Props> = ({ children }) => {
	const objectUrlsRef = useRef<ReadonlyMap<string, string>>(new Map());
	const [loaded, setLoaded] = useState<{
		config: GameSchema.Type;
		resources: ReadonlyArray<ResourceSchema.Type>;
		resourceUrlById: ReadonlyMap<string, string>;
		fileName: string;
		fileSize: number;
	} | null>(null);

	const revokeObjectUrls = useCallback(() => {
		for (const url of objectUrlsRef.current.values()) {
			URL.revokeObjectURL(url);
		}
		objectUrlsRef.current = new Map();
	}, []);

	useEffect(
		() => revokeObjectUrls,
		[
			revokeObjectUrls,
		],
	);

	const mutation = useMutation({
		mutationFn: async (file: File) => {
			if (!file.name.toLowerCase().endsWith(".arkpack")) {
				throw new Error("Choose an .arkpack file.");
			}

			const payload = await Effect.runPromise(
				readGamePackFx(new Uint8Array(await file.arrayBuffer())),
			);
			const resourceUrlById = new Map(
				payload.resources.map((resource) => [
					resource.id,
					URL.createObjectURL(
						new Blob(
							[
								resource.bytes.slice().buffer,
							],
							{
								type: resource.mime,
							},
						),
					),
				]),
			);

			return {
				...payload,
				resourceUrlById,
				fileName: file.name,
				fileSize: file.size,
			};
		},
		onSuccess: (result) => {
			revokeObjectUrls();
			objectUrlsRef.current = result.resourceUrlById;
			setLoaded(result);
		},
	});

	const reset = useCallback(() => {
		revokeObjectUrls();
		setLoaded(null);
		mutation.reset();
	}, [
		mutation,
		revokeObjectUrls,
	]);

	const load = useCallback(
		async (file: File) => {
			await mutation.mutateAsync(file);
		},
		[
			mutation,
		],
	);

	const value = useMemo<DevGamePackContextValue>(
		() => ({
			config: loaded?.config ?? null,
			resources: loaded?.resources ?? [],
			resourceUrlById: loaded?.resourceUrlById ?? new Map(),
			fileName: loaded?.fileName ?? null,
			fileSize: loaded?.fileSize ?? null,
			isLoading: mutation.isPending,
			error: mutation.error,
			load,
			reset,
		}),
		[
			load,
			loaded,
			mutation.error,
			mutation.isPending,
			reset,
		],
	);

	return <DevGamePackContext.Provider value={value}>{children}</DevGamePackContext.Provider>;
};
