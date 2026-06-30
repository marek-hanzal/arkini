# 2026-06-25 School / Academy / University asset prep

## Scope
Prepared the education building asset layer only. No gameplay production, no knowledge products, no craft recipes, and no blueprint purchase flow were wired yet.

## Added visual assets
- `producer-school.png`
- `producer-academy.png`
- `producer-university.png`

The source batch images were cut out from generated checkerboard backgrounds, cropped, and resized to 128x128 transparent PNGs to match the existing asset pipeline.

## Added item definitions
- `producer:school`
- `producer:academy`
- `producer:university`
- `item:blueprint-school`
- `item:blueprint-academy`
- `item:blueprint-university`

## Intentional omissions
- No `producerId` attached yet.
- No `craftRecipeId` attached to blueprint items yet.
- No products / knowledge output configured yet.
- No Town Hall or purchase source configured yet.

The next gameplay pass should wire School -> Basic Knowledge, Academy -> Advanced Knowledge, and University -> Master Knowledge, then decide how their blueprints are bought and how construction replaces/upgrades the previous institution.
