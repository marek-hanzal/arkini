import { Effect } from "effect";
import { match, P } from "ts-pattern";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";

export namespace parseArkpackTrustFx {
	export interface Props {
		readonly value: unknown;
	}
}

/** Parses persisted imported-Arkpack trust metadata. */
export const parseArkpackTrustFx = Effect.fn("parseArkpackTrustFx")(
	({ value }: parseArkpackTrustFx.Props) =>
		Effect.succeed(
			match(value)
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
