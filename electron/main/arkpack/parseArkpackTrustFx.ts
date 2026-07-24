import { Effect } from "effect";
import { match, P } from "ts-pattern";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";

export namespace parseArkpackTrustFx {
	export interface Props {
		readonly value: unknown;
	}
}

/** Parses persisted trust metadata while preserving legacy unsigned imports. */
export const parseArkpackTrustFx = Effect.fn("parseArkpackTrustFx")(
	({ value }: parseArkpackTrustFx.Props) =>
		Effect.succeed(
			match(value)
				.with(
					undefined,
					() =>
						({
							type: "external",
							reason: "unsigned",
						}) as const,
				)
				.with(
					{
						type: "official",
						keyId: P.string,
					},
					(trust) =>
						trust.keyId.length > 0
							? ({
									type: "official",
									keyId: trust.keyId,
								} as const)
							: undefined,
				)
				.with(
					{
						type: "external",
						reason: P.union("unsigned", "unknown-key"),
					},
					(trust) =>
						({
							type: "external",
							reason: trust.reason,
						}) as const,
				)
				.with(
					{
						type: "invalid",
						reason: P.union(
							"malformed-signature",
							"invalid-signature",
							"hash-mismatch",
						),
						keyId: P.optional(P.string),
					},
					(trust) =>
						({
							type: "invalid",
							reason: trust.reason,
							...(trust.keyId === undefined
								? {}
								: {
										keyId: trust.keyId,
									}),
						}) as const,
				)
				.otherwise(() => undefined) satisfies
				| ArkiniElectronApi.ArkpackDescriptor["trust"]
				| undefined,
		),
);
