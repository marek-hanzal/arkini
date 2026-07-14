# V1 canonical ID schema policy

All exact identities in Arkini v1 use the single shared `IdSchema` contract.

This applies across authoring config, compiled config, resource manifests, runtime, state, jobs, lines, items, assets, references and command arguments.

Do not introduce domain-specific ID schemas or aliases such as:

- `ItemIdSchema`
- `LineIdSchema`
- `JobIdSchema`
- `AssetIdSchema`
- `ResourceIdSchema`

Domain meaning belongs to the field name, containing schema, descriptions and semantic validators. It must not create a parallel scalar identity type.

Opaque non-identity tokens with different semantics, such as optimistic concurrency revisions, may retain their own schemas.

When adding or reviewing an identifier field:

1. use `IdSchema` directly;
2. validate domain references and uniqueness at the owning schema/compiler/runtime boundary;
3. audit existing code for identifier fields backed by generic strings and migrate them to `IdSchema`.
