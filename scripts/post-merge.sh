#!/bin/bash
set -e

# Keep dependency setup reproducible, then apply only versioned application
# migrations. Do not use the workspace @workspace/db push command here:
# it compares a separate package schema to the app database and can propose
# destructive table drops in a non-interactive post-merge run.
pnpm install --frozen-lockfile
pnpm --filter @workspace/istanbul-vip-transfer db:migrate
