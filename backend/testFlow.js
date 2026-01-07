import dotenv from "dotenv";

dotenv.config();

// Get backend URL from environment or use default localhost
const BASE_URL = process.env.NODE_SERVER_URL || "http://localhost:3000";

// ANSI color codes for colored console output
const colors = {
  reset: "\x1b[0m",    // Reset color
  bright: "\x1b[1m",  // Bold/bright text
  green: "\x1b[32m",  // Green color
  yellow: "\x1b[33m", // Yellow color
  blue: "\x1b[34m",   // Blue color
  red: "\x1b[31m",    // Red color
  cyan: "\x1b[36m"    // Cyan color
};

/**
 * Logs a step header with colored formatting
 * @param {string} step - Step name/number
 * @param {string} message - Step description
 */
function logStep(step, message) {
  console.log(`\n${colors.cyan}${colors.bright}=== ${step} ===${colors.reset}`);
  console.log(message);
}

/**
 * Logs a success message in green
 * @param {string} message - Success message
 */
function logSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

/**
 * Logs an error message in red
 * @param {string} message - Error message
 */
function logError(message) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

/**
 * Logs an info message in blue
 * @param {string} message - Info message
 */
function logInfo(message) {
  console.log(`${colors.blue}ℹ ${message}${colors.reset}`);
}

// ============================================================================
// TEST DATA
// ============================================================================
// Sample data used to simulate a real user journey

// Test user information
const testUser = {
  user_id: "test_agent_001", // Test agent identifier
  problem_description: "Users are unable to connect to the company VPN. The connection times out after 30 seconds. This started happening after a recent Windows update was deployed."
};

// Follow-up answers for initial problem clarification (Steps 2-3)
const followUpAnswers = [
  "The issue affects about 50% of Windows 10 users who recently installed KB5018410 update.",
  "The VPN client version is 2.5.3 and the server is running on Windows Server 2019."
];

// User's solution description (Step 4)
const userSolution = "I resolved this by rolling back the Windows update KB5018410, then reinstalling the VPN client version 2.5.4 which includes compatibility fixes for the latest Windows updates. After reinstalling, users were able to connect successfully.";

// Follow-up question responses (Steps 6-8)
const followUpResponses = [
  "The root cause was a compatibility issue between the Windows update KB5018410 and the VPN client's network stack implementation.",
  "The specific steps were: 1) Identify affected users, 2) Roll back KB5018410 update, 3) Download VPN client 2.5.4 from vendor portal, 4) Uninstall old client, 5) Install new client, 6) Verify connection.",
  "Prerequisites: Admin access to user machines, VPN client installer file, and a maintenance window. Dependencies: Windows 10 version 1909 or later."
];

// ============================================================================
// GLOBAL STATE VARIABLES
// ============================================================================
// Track IDs throughout the test flow

let sessionId = null;      // Chat session ID from backend
let problemId = null;       // Problem ID from backend
let savedSolutionId = null; // Solution ID after saving

/**
 * Makes HTTP request to backend API with error handling
 * Handles timeouts, HTTP errors, and network errors
 * @param {string} endpoint - API endpoint path
 * @param {Object} data - Request payload data
 * @param {string} stepName - Name of test step for error reporting
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
async function makeRequest(endpoint, data, stepName) {
  try {
    // Construct full URL
    const url = `${BASE_URL}${endpoint}`;
    logInfo(`Calling ${endpoint}`);
    
    // Set up timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000000); // 50 minute timeout
    
    // Make HTTP POST request
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json" // JSON content type
      },
      body: JSON.stringify(data), // Convert data to JSON string
      signal: controller.signal // Attach abort signal for timeout
    });
    
    // Clear timeout if request completed
    clearTimeout(timeoutId);
    
    // Check if response is OK (status 200-299)
    if (!response.ok) {
      // Try to parse error response
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
    }
    
    // Parse successful JSON response
    const responseData = await response.json();
    return { success: true, data: responseData };
  } catch (error) {
    // Log error with step name
    logError(`${stepName} failed at ${endpoint}`);
    
    // Handle different error types
    if (error.name === "AbortError") {
      // Request timed out
      console.error(`Request timeout. Is the server running at ${BASE_URL}?`);
    } else if (error.message.includes("HTTP")) {
      // HTTP error (4xx, 5xx)
      console.error(`Error: ${error.message}`);
    } else {
      // Network or other error
      console.error(`Error: ${error.message}`);
      console.error(`Is the server running at ${BASE_URL}?`);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Main test flow function
 * Executes complete user journey simulation step by step
 * Makes real HTTP calls to backend and logs all responses
 */
async function runTestFlow() {
  // Display test header banner
  console.log(`${colors.bright}${colors.yellow}`);
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     IT Support Data Quality Verifier - Test Flow         ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(colors.reset);

  // ========================================================================
  // STEP 1: Start chat session
  // ========================================================================
  logStep("STEP 1", "Starting chat with sample IT problem");
  const startResult = await makeRequest(
    "/api/chat/start",
    {
      user_id: testUser.user_id,
      problem_description: testUser.problem_description
    },
    "Start Chat"
  );

  if (!startResult.success) {
    logError("Cannot proceed without session. Exiting.");
    process.exit(1);
  }

  // Extract session and problem IDs from response
  sessionId = startResult.data.session_id;
  problemId = startResult.data.problem_id;
  logSuccess(`Session created: ${sessionId}`);
  logSuccess(`Problem ID: ${problemId}`);
  console.log(`AI Response: ${startResult.data.ai_response}`);

  // ========================================================================
  // STEPS 2-3: Provide follow-up answers
  // ========================================================================
  // Simulate user providing additional problem details
  for (let i = 0; i < followUpAnswers.length; i++) {
    logStep(`STEP ${i + 2}`, `Providing follow-up answer ${i + 1}/2`);
    
    const messageResult = await makeRequest(
      "/api/chat/message",
      {
        session_id: sessionId,
        user_message: followUpAnswers[i],
        message_type: "response"
      },
      `Follow-up Answer ${i + 1}`
    );

    if (!messageResult.success) {
      logError(`Follow-up answer ${i + 1} failed. Continuing anyway...`);
      continue;
    }

    console.log(`User: ${followUpAnswers[i]}`);
    console.log(`AI Response: ${messageResult.data.response}`);
    console.log(`Next Action: ${messageResult.data.next_action}`);
    logSuccess(`Follow-up ${i + 1} processed`);
  }

  // ========================================================================
  // STEP 4: Submit solution
  // ========================================================================
  // User provides their solution to the problem
  logStep("STEP 4", "Submitting user solution");
  const solutionMessageResult = await makeRequest(
    "/api/chat/message",
    {
      session_id: sessionId,
      user_message: userSolution,
      message_type: "user_solution"
    },
    "Submit Solution"
  );

  if (!solutionMessageResult.success) {
    logError("Solution submission failed. Continuing to validation...");
  } else {
    console.log(`User Solution: ${userSolution}`);
    console.log(`AI Response: ${solutionMessageResult.data.response}`);
    console.log(`Next Action: ${solutionMessageResult.data.next_action}`);
    logSuccess("Solution submitted");
  }

  // ========================================================================
  // STEP 5: Validate solution
  // ========================================================================
  // Backend compares solution against existing solutions in database
  logStep("STEP 5", "Validating solution against existing solutions");
  const validateResult = await makeRequest(
    "/api/solutions/validate",
    {
      user_solution: userSolution,
      problem_id: problemId
    },
    "Validate Solution"
  );

  if (!validateResult.success) {
    logError("Validation failed. Cannot proceed to follow-ups.");
    process.exit(1);
  }

  const validation = validateResult.data.validation_result;
  const status = validateResult.data.status;
  console.log(`Validation Status: ${status}`);
  console.log(`Matches: ${validation.matches}`);
  console.log(`Match Percentage: ${validation.percentage}%`);
  if (validateResult.data.existing_solutions_count !== undefined) {
    console.log(`Existing Solutions Count: ${validateResult.data.existing_solutions_count}`);
  }
  logSuccess("Solution validated");

  // ========================================================================
  // STEPS 6-8: Respond to follow-up questions
  // ========================================================================
  // User answers 3 follow-up questions to improve solution documentation
  for (let i = 0; i < followUpResponses.length; i++) {
    logStep(`STEP ${i + 6}`, `Responding to follow-up question ${i + 1}/3`);
    
    const followUpResult = await makeRequest(
      "/api/chat/message",
      {
        session_id: sessionId,
        user_message: followUpResponses[i],
        message_type: "response"
      },
      `Follow-up Question ${i + 1}`
    );

    if (!followUpResult.success) {
      logError(`Follow-up question ${i + 1} failed. Continuing anyway...`);
      continue;
    }

    console.log(`User Response: ${followUpResponses[i]}`);
    console.log(`AI Response: ${followUpResult.data.response}`);
    console.log(`Next Action: ${followUpResult.data.next_action}`);
    logSuccess(`Follow-up question ${i + 1} answered`);
  }

  // ========================================================================
  // STEP 9: Confirm and save final solution
  // ========================================================================
  // Compile all information and save solution to database
  logStep("STEP 9", "Confirming and saving final solution");
  
  // Compile solution details from conversation
  // First follow-up response is typically root cause analysis
  const rootCauseAnalysis = followUpResponses[0] || "Root cause analysis based on user responses";
  // Combine initial solution with follow-up responses
  const solutionDetails = [
    userSolution,
    ...followUpResponses.slice(1) // Skip first response (used as root cause)
  ].join("\n\n");

  const saveResult = await makeRequest(
    "/api/solutions/save",
    {
      session_id: sessionId,
      problem_description: testUser.problem_description,
      root_cause_analysis: rootCauseAnalysis,
      solution_details: solutionDetails
    },
    "Save Solution"
  );

  if (!saveResult.success) {
    logError("Failed to save solution");
    process.exit(1);
  }

  savedSolutionId = saveResult.data.solution_id;
  logSuccess(`Solution saved with ID: ${savedSolutionId}`);
  console.log(`Saved At: ${saveResult.data.saved_at}`);

  // Final Summary
  logStep("TEST COMPLETE", "Summary");
  console.log(`${colors.green}${colors.bright}✓ All steps completed successfully!${colors.reset}`);
  console.log(`\n${colors.bright}Session Details:${colors.reset}`);
  console.log(`  Session ID: ${sessionId}`);
  console.log(`  Problem ID: ${problemId}`);
  console.log(`  Solution ID: ${savedSolutionId}`);
  console.log(`  Validation Status: ${status}`);
  console.log(`  Match Percentage: ${validation.percentage}%`);
  
  console.log(`\n${colors.bright}Final Solution:${colors.reset}`);
  console.log(`  Problem: ${testUser.problem_description}`);
  console.log(`  Root Cause: ${rootCauseAnalysis}`);
  console.log(`  Solution: ${solutionDetails.substring(0, 200)}...`);
  
  console.log(`\n${colors.green}Test flow completed successfully!${colors.reset}\n`);
}

// Run the test
runTestFlow().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

