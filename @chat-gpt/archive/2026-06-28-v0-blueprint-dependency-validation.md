# Blueprint dependency validation

Added central `GameConfigSchema` validation for blueprint progression dependency cycles. The check builds a blueprint-to-blueprint dependency graph from blueprint craft recipe inputs/requirements, product lines that output blueprints, producer/stash requirements behind those product lines, and merge sources that create blueprints.

The first run correctly caught the live config bug where `item:blueprint-house-t1` through `item:blueprint-house-t4` consumed themselves as craft inputs. Those self-inputs were removed; a blueprint item is already the craft target and must not also be a required input.

`game:validate` and `game:compile` now fail the same central schema path for direct self-references and indirect blueprint/building loops.
