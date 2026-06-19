# Schema core rollback

Rolled back the `GameSaveSchema` validation split.

Reason: `GameConfigSchema` and `GameSaveSchema` are intentional dense core contracts. Splitting them purely to reduce file size can increase future mental load by spreading schema shape, cross-config validation, types, and `superRefine` context across more files.

Rule:

- Do not treat central schema line count as a cleanup target.
- Keep schema/core validation visible when runtime/config/save changes are made.
- Split only with a concrete proven benefit, not because a file is large.
