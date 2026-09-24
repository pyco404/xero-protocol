#!/usr/bin/env bash
# Starts the spike's localnet: Agave 4.3.0 test validator on :8999 running the exact mainnet
# binaries of Token-2022 and spl-record (dumped read-only from mainnet into .programs/).
# Every feature gate is active on a test validator, including zk-elgamal re-enable.
set -euo pipefail
cd "$(dirname "$0")"
BIN="${AGAVE_BIN:-$HOME/.local/share/solana/install/releases/v4.3.0/solana-release/bin}"
MAINNET=https://api.mainnet-beta.solana.com
TOKEN22=TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
RECORD=recr1L3PCGKLbckBqMNcJhuuyU1zgo8nBhfLVsJNwr5
mkdir -p .programs
[ -f .programs/token-2022.so ] || "$BIN/solana" program dump "$TOKEN22" .programs/token-2022.so -u "$MAINNET"
[ -f .programs/spl-record.so ] || "$BIN/solana" program dump "$RECORD" .programs/spl-record.so -u "$MAINNET"
sha256sum .programs/*.so
EXTRA=()
for so in ${SPIKE_PROGRAMS:-}; do EXTRA+=(--bpf-program "${so%%=*}" "${so#*=}"); done
exec "$BIN/solana-test-validator" --ledger .ledger --reset --quiet \
  --rpc-port 8999 --faucet-port 19900 --gossip-port 18001 --dynamic-port-range 18002-18040 \
  --bpf-program "$TOKEN22" .programs/token-2022.so \
  --bpf-program "$RECORD" .programs/spl-record.so "${EXTRA[@]}"
