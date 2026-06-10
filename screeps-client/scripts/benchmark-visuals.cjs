const { performance } = require('perf_hooks');

// Benchmark data: Valid JSON lines mixed with some invalid ones
const validLines = Array(1000).fill('{"t":"c","x":5,"y":5,"s":{"radius":1}}');
const invalidLines = Array(10).fill('{"t":');
const lines = [...validLines, ...invalidLines].sort(() => Math.random() - 0.5);
const rawMixed = lines.join('\n') + '\n\n' + lines.join('\n');
const rawValid = validLines.join('\n');

function runBaseline(str) {
  let entries = [];
  for (const line of str.split('\n')) {
    if (!line.trim()) continue;
    try { entries.push(JSON.parse(line)); } catch { continue; }
  }
  return entries;
}

function runOptimized(str) {
  let entries = [];
  const safeStr = str.trim();
  if (safeStr) {
    try {
      const jsonStr = '[' + safeStr.split('\n').filter(l => l.trim()).join(',') + ']';
      entries = JSON.parse(jsonStr);
    } catch {
      for (const line of str.split('\n')) {
        if (!line.trim()) continue;
        try { entries.push(JSON.parse(line)); } catch { continue; }
      }
    }
  }
  return entries;
}

const ITERATIONS = 10000;

console.log("=== BENCHMARK: JSON PARSING FAST PATH ===");

// 1. Valid Only (Fast path hit)
console.log("\nMeasuring Baseline (Valid Only)...");
let start = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  runBaseline(rawValid);
}
let end = performance.now();
const baselineTimeValid = end - start;
console.log(`Baseline (Valid): ${baselineTimeValid.toFixed(2)}ms`);

console.log("Measuring Optimized (Valid Only)...");
start = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  runOptimized(rawValid);
}
end = performance.now();
const optimizedTimeValid = end - start;
console.log(`Optimized (Valid): ${optimizedTimeValid.toFixed(2)}ms`);

console.log(`Improvement (Valid Only): ${(((baselineTimeValid - optimizedTimeValid) / baselineTimeValid) * 100).toFixed(2)}% faster`);

// 2. Mixed Valid/Invalid (Fallback hit)
console.log("\nMeasuring Baseline (Mixed valid/invalid)...");
start = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  runBaseline(rawMixed);
}
end = performance.now();
const baselineTimeMixed = end - start;
console.log(`Baseline (Mixed): ${baselineTimeMixed.toFixed(2)}ms`);

console.log("Measuring Optimized (Mixed valid/invalid fallback)...");
start = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  runOptimized(rawMixed);
}
end = performance.now();
const optimizedTimeMixed = end - start;
console.log(`Optimized (Mixed fallback): ${optimizedTimeMixed.toFixed(2)}ms`);

console.log(`Overhead of fallback (Mixed): ${(((optimizedTimeMixed - baselineTimeMixed) / baselineTimeMixed) * 100).toFixed(2)}% slower`);
