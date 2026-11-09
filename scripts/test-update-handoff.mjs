// The upstream installer-launch UI was intentionally removed in OpsWolf F32.
// Keep this historical test command active: verify the stronger no-download /
// no-launch policy instead of expecting an installer handoff. Legacy asset,
// digest, URL and native window-handoff verification remain in Rust unit tests.
await import('./test-update-policy.mjs');
