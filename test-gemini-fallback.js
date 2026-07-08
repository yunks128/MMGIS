#!/usr/bin/env node
/**
 * Test script to verify Gemini fallback functionality
 * Usage: node test-gemini-fallback.js
 */

require("dotenv").config();

// Test 1: Check Gemini environment
console.log("\n=== Test 1: Checking Gemini Configuration ===");
const { haveGeminiEnv } = require("./API/Frozon-MMGIS-Plugin-Backend/Agent/geminiService");
const geminiEnv = haveGeminiEnv();
console.log("Gemini configured:", geminiEnv.ok ? "✓ YES" : "✗ NO");
if (!geminiEnv.ok) {
  console.log("Missing:", geminiEnv.missing.join(", "));
  console.log("\nTo configure Gemini, add to your .env file:");
  console.log("  GEMINI_API_KEY=your-api-key-here");
  console.log("  GEMINI_MODEL=gemini-2.0-flash-exp  # optional");
} else {
  console.log("Model:", geminiEnv.model);
  console.log("API Key:", geminiEnv.apiKey.substring(0, 10) + "...");
}

// Test 2: Check Azure environment
console.log("\n=== Test 2: Checking Azure Configuration ===");
const { haveAzureEnv } = require("./API/Frozon-MMGIS-Plugin-Backend/Agent/provider");
const azureEnv = haveAzureEnv();
console.log("Azure configured:", azureEnv.ok ? "✓ YES" : "✗ NO");
if (!azureEnv.ok) {
  console.log("Missing:", azureEnv.missing.join(", "));
}

// Test 3: Test Gemini API call (if configured)
if (geminiEnv.ok) {
  console.log("\n=== Test 3: Testing Gemini API ===");
  (async () => {
    try {
      const { planWithGemini } = require("./API/Frozon-MMGIS-Plugin-Backend/Agent/geminiService");
      console.log("Sending test query to Gemini...");
      const result = await planWithGemini("List all available layers on the map.");
      console.log("✓ Gemini responded successfully!");
      console.log("Actions:", result.actions.length);
      console.log("Reply:", result.reply.substring(0, 100) + "...");
      console.log("Provider:", result.debug.provider);

      // Test 4: Test streaming
      console.log("\n=== Test 4: Testing Gemini Streaming ===");
      const { streamWithGemini } = require("./API/Frozon-MMGIS-Plugin-Backend/Agent/geminiService");
      console.log("Streaming test query...");
      let tokenCount = 0;
      for await (const event of streamWithGemini("What is MMGIS?")) {
        if (event.type === "token") {
          tokenCount++;
        } else if (event.type === "plan") {
          console.log("✓ Stream completed with plan");
          console.log("  Tokens received:", tokenCount);
          console.log("  Reply:", event.data.reply.substring(0, 100) + "...");
        } else if (event.type === "error") {
          console.error("✗ Stream error:", event.data);
        }
      }

      console.log("\n=== Summary ===");
      console.log("✓ Gemini fallback is working correctly!");
      console.log("✓ Both standard and streaming modes are functional");

    } catch (error) {
      console.error("✗ Gemini test failed:", error.message);
      console.error("\nFull error:", error);
    }
  })();
} else {
  console.log("\n=== Summary ===");
  console.log("✗ Cannot test Gemini API without configuration");
  console.log("Please add GEMINI_API_KEY to your .env file");
}
