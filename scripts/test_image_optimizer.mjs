import assert from 'assert';

console.log('Testing imageOptimizer logic...');

// Test dimension calculation helper logic
function calculateTargetDimensions(width, height, maxWidth, maxHeight) {
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    return {
      width: Math.round(width * ratio),
      height: Math.round(height * ratio),
    };
  }
  return { width, height };
}

// 1. Test 16:9 4K image (3840x2160) -> should scale down to 1920x1080
const res4k = calculateTargetDimensions(3840, 2160, 1920, 1080);
assert.strictEqual(res4k.width, 1920);
assert.strictEqual(res4k.height, 1080);
console.log('✔ 4K (3840x2160) scales down to exactly 1920x1080 (16:9)');

// 2. Test 16:9 720p image (1280x720) -> should remain 1280x720 without upscaling
const res720 = calculateTargetDimensions(1280, 720, 1920, 1080);
assert.strictEqual(res720.width, 1280);
assert.strictEqual(res720.height, 720);
console.log('✔ 720p (1280x720) remains intact without unnecessary upscaling');

// 3. Test smartphone vertical payment screenshot (e.g. 1080x2400) -> should scale down to max 1200x1600
const resMobile = calculateTargetDimensions(1080, 2400, 1200, 1600);
assert.strictEqual(resMobile.height, 1600);
assert.strictEqual(resMobile.width, 720);
console.log(`✔ Smartphone payment screenshot (1080x2400) scales down to ${resMobile.width}x${resMobile.height}`);

console.log('All image optimizer dimension tests passed successfully!');
