// Example MoltChain Smart Contract (Rust → WASM)
// Simple counter contract

// This would be compiled to WASM bytecode
// For demo, we'll use minimal WASM module

/// Contract state
static mut COUNTER: u64 = 0;

/// Increment counter
#[no_mangle]
pub extern "C" fn increment() -> u64 {
    unsafe {
        COUNTER += 1;
        COUNTER
    }
}

/// Get current count
#[no_mangle]
pub extern "C" fn get_count() -> u64 {
    unsafe { COUNTER }
}

/// Reset counter
#[no_mangle]
pub extern "C" fn reset() {
    unsafe {
        COUNTER = 0;
    }
}

// To compile:
// rustc --target wasm32-unknown-unknown -O --crate-type=cdylib counter.rs -o counter.wasm
