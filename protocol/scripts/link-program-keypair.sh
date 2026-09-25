#!/usr/bin/env sh
# The program keypair lives outside the repo, in ~/.config/zero/. Anchor expects it at
# target/deploy/, and generates a random one there if it is missing, so link it in before
# every build. Without the key (e.g. on a new machine) the build still works; only deploys need it.
set -e
KEY="${ZERO_PROGRAM_KEYPAIR:-$HOME/.config/zero/zero_policy-keypair.json}"
mkdir -p target/deploy
if [ -f "$KEY" ]; then
  ln -sf "$KEY" target/deploy/zero_policy-keypair.json
else
  echo "warning: $KEY not found; anchor will generate a throwaway program keypair" >&2
fi
