// Single on/off switch for the E2E messaging path (decision #98, 2026-09-02
// pause). Flipping this back to true is meant to be the whole reactivation
// step for the client side — every crypto/device-linking/escrow module stays
// in place and importable, just unexercised, so a later session can resume
// E2E without reconstructing it (gavi411-e2e-encryption-plan.md §5/§6).
export const E2E_ENABLED = false
