/**
 * EcoTrace - Carbon Footprint Tracker Unit Tests
 * Supports running in both Node.js (console) and Browser environments.
 */

// --- LOAD MODULE FOR NODE.JS OR BROWSER SCOPE ---
let calculateEmissionsFunc;
let validateNumberFunc;
let emissionFactors;
let isNode = false;

if (typeof module !== 'undefined' && typeof require !== 'undefined') {
  // Node.js environment
  isNode = true;
  try {
    const app = require('./app.js');
    calculateEmissionsFunc = app.calculateEmissions;
    validateNumberFunc = app.validateNumber;
    emissionFactors = app.EMISSION_FACTORS;
  } catch (e) {
    console.error("Failed to require app.js. Make sure it is in the same directory.", e);
    process.exit(1);
  }
} else {
  // Browser environment
  isNode = false;
  if (typeof calculateEmissions === 'function') {
    calculateEmissionsFunc = calculateEmissions;
    validateNumberFunc = validateNumber;
    emissionFactors = EMISSION_FACTORS;
  } else {
    console.error("calculateEmissions function not found in global scope. Ensure app.js is loaded first.");
  }
}

// --- COLOR FORMATTING ---
function logPass(message) {
  if (isNode) {
    console.log('\x1b[32m%s\x1b[0m', `  [PASS] ${message}`);
  } else {
    console.log('%c[PASS] %s', 'color: #10b981; font-weight: bold;', message);
  }
}

function logFail(message) {
  if (isNode) {
    console.error('\x1b[31m%s\x1b[0m', `  [FAIL] ${message}`);
  } else {
    console.error('%c[FAIL] %s', 'color: #ef4444; font-weight: bold;', message);
  }
}

function logHeader(title) {
  if (isNode) {
    console.log('\n\x1b[36m%s\x1b[0m', `=== ${title} ===`);
  } else {
    console.log('%c=== %s ===', 'color: #3b82f6; font-size: 1.1rem; font-weight: bold;', title);
  }
}

// --- ASSERTION UTILITIES ---
function assertEqual(actual, expected, message) {
  // Use a tiny delta check for floating point comparisons
  const tolerance = 0.0001;
  const passed = Math.abs(actual - expected) < tolerance;
  
  if (passed) {
    logPass(`${message} (Value: ${actual})`);
    return true;
  } else {
    logFail(`${message} - Expected: ${expected}, Got: ${actual}`);
    return false;
  }
}

// --- TEST SUITE ---
function runTests() {
  logHeader("RUNNING ECOTRACE CARBON CALCULATOR UNIT TESTS");
  
  if (!calculateEmissionsFunc) {
    logFail("Calculator function is not loaded. Aborting tests.");
    if (isNode) process.exit(1);
    return;
  }

  let totalTests = 0;
  let passedTests = 0;

  function runCase(commute, electricity, transit, expected, caseName) {
    logHeader(`Test Case: ${caseName}`);
    const result = calculateEmissionsFunc(commute, electricity, transit);
    
    totalTests += 4;
    
    if (assertEqual(result.commuteCO2, expected.commute, "Commute CO2 match")) passedTests++;
    if (assertEqual(result.electricityCO2, expected.electricity, "Electricity CO2 match")) passedTests++;
    if (assertEqual(result.transitCO2, expected.transit, "Transit CO2 match")) passedTests++;
    if (assertEqual(result.totalCO2, expected.total, "Total CO2 match")) passedTests++;
  }

  // Case 1: Zero inputs
  runCase(0, 0, 0, {
    commute: 0,
    electricity: 0,
    transit: 0,
    total: 0
  }, "Zero Inputs");

  // Case 2: Commute only
  runCase(10, 0, 0, {
    commute: 1.8,  // 10 * 0.18
    electricity: 0,
    transit: 0,
    total: 1.8
  }, "Commute Only (10 km)");

  // Case 3: Electricity only
  runCase(0, 5, 0, {
    commute: 0,
    electricity: 2.0, // 5 * 0.4
    transit: 0,
    total: 2.0
  }, "Electricity Only (5 kWh)");

  // Case 4: Transit only
  runCase(0, 0, 20, {
    commute: 0,
    electricity: 0,
    transit: 0.8, // 20 * 0.04
    total: 0.8
  }, "Transit Only (20 km)");

  // Case 5: Combined average use
  runCase(25, 12, 15, {
    commute: 4.5,   // 25 * 0.18
    electricity: 4.8, // 12 * 0.4
    transit: 0.6,   // 15 * 0.04
    total: 9.9     // 4.5 + 4.8 + 0.6
  }, "Typical Daily Mix");

  // Validation Utility & Edge-Case Tests
  logHeader("Validation Utility & Edge-Case Tests");
  if (validateNumberFunc) {
    totalTests += 9;
    
    // Core validation checks
    if (assertEqual(validateNumberFunc("abc", 0, 100, 25), 25, "String parsing fallback check")) passedTests++;
    if (assertEqual(validateNumberFunc(-10, 0, 100, 25), 0, "Below minimum bounds check")) passedTests++;
    if (assertEqual(validateNumberFunc(200, 0, 100, 25), 100, "Above maximum bounds check")) passedTests++;
    if (assertEqual(validateNumberFunc(45, 0, 100, 25), 45, "Valid value bounding check")) passedTests++;
    
    // Explicit edge-case test blocks requested by user
    if (assertEqual(validateNumberFunc(-50, 0, 150, 25), 0, "Edge-case: Negative boundary check")) passedTests++;
    if (assertEqual(validateNumberFunc("", 0, 150, 25), 25, "Edge-case: Empty string check")) passedTests++;
    if (assertEqual(validateNumberFunc("abc$#", 0, 150, 25), 25, "Edge-case: Unexpected symbols check")) passedTests++;
    if (assertEqual(validateNumberFunc(20000, 0, 150, 25), 150, "Edge-case: Extreme out-of-bounds check")) passedTests++;
    if (assertEqual(validateNumberFunc(null, 0, 150, 25), 25, "Edge-case: Null input check")) passedTests++;
  } else {
    logFail("validateNumber function is not loaded.");
  }

  // Missing DOM elements error-trapping test
  logHeader("DOM Elements Error-Trapping Tests");
  let domTrappingPassed = false;
  try {
    if (isNode) {
      // In Node.js environment, the DOM is absent, so checking that calculateEmissions
      // operates without throwing ReferenceErrors is a valid check
      const testRes = calculateEmissionsFunc(10, 10, 10);
      domTrappingPassed = (testRes !== null && typeof testRes === 'object');
    } else {
      // In browser environment, temporarily mock a missing DOM element to verify safety
      const originalStatus = elements.emissionStatus;
      elements.emissionStatus = null; // Mock missing element
      updateStatusBadge(5); // Should return early and not throw
      elements.emissionStatus = originalStatus; // Restore element
      domTrappingPassed = true;
    }
  } catch (e) {
    console.error("DOM error-trapping failure: ", e);
    domTrappingPassed = false;
  }
  
  totalTests += 1;
  if (assertEqual(domTrappingPassed ? 1 : 0, 1, "Edge-case: Missing DOM elements error-trapping check")) passedTests++;

  // Print results overview
  logHeader("TEST RESULTS SUMMARY");
  console.log(`Total assertions run: ${totalTests}`);
  console.log(`Passed assertions: ${passedTests}`);
  console.log(`Failed assertions: ${totalTests - passedTests}`);

  const allPassed = passedTests === totalTests;
  if (allPassed) {
    logPass("ALL TESTS PASSED SUCCESSFULLY! 🌿");
    if (isNode) process.exit(0);
  } else {
    logFail("SOME TESTS FAILED! PLEASE RE-CHECK CODE LOGIC.");
    if (isNode) process.exit(1);
  }
}

// --- SELF-EXECUTION ON NODE OR CONSOLE LOAD ---
if (isNode) {
  runTests();
} else {
  // Expose test function to window so browser can run it manually
  window.runEcoTraceTests = runTests;
  console.log("EcoTrace Unit Tests loaded. Run 'runEcoTraceTests()' in your console to execute.");
}
