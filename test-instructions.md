# Testing Real Raster Difference Calculation

## Quick Test Instructions

1. Open MMGIS in your browser: http://localhost:8891/?mission=frozon

2. Open browser console (F12 or Cmd+Option+J)

3. Copy and paste this test command:

```javascript
// Quick test - ask about layer difference
document.querySelector('[title*="Copilot"]')?.click();
setTimeout(() => {
    const input = document.querySelector('#agentChatInput');
    const send = document.querySelector('#agentChatSend');
    input.value = 'What is the difference between SWOT and ICESat-2 sea ice thickness?';
    send.click();
}, 1000);
```

4. Check the response - it should show either:
   - Real difference statistics (if COG data is available)
   - Simulated difference (fallback mode)

## Expected Behavior

### With COG Data Available:
- Shows "Real Difference:" header
- Displays actual statistics (mean, std, min, max)
- Shows pixel count and coverage percentage

### Without COG Data (Fallback):
- Shows "Simulated Difference:" header  
- Displays example values
- Note about simulation

## Full Test Suite

For comprehensive testing, run the test script:

```bash
# In browser console, paste contents of:
cat test-raster-difference.js
```

This will test:
1. Module loading
2. Layer difference calculation
3. Response formatting
4. Time-series animation

## Verification

Check if the module loaded successfully:
```javascript
console.log('Raster module:', window.rasterDifference ? 'Loaded' : 'Not loaded');
```

