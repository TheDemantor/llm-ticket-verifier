import streamlit as st
import requests
import os
from dotenv import load_dotenv

load_dotenv()

st.set_page_config(
    page_title="IT Support Data Quality Verifier",
    page_icon="🔍",
    layout="wide"
)

st.title("IT Support Data Quality Verifier")

# Initialize session state variables for app persistence across reruns
if "session_id" not in st.session_state:
    st.session_state.session_id = None

if "messages" not in st.session_state:
    st.session_state.messages = []

if "problem_description" not in st.session_state:
    st.session_state.problem_description = None

if "problem_id" not in st.session_state:
    st.session_state.problem_id = None

if "current_phase" not in st.session_state:
    st.session_state.current_phase = None

if "user_id" not in st.session_state:
    st.session_state.user_id = ""

if "chat_input_enabled" not in st.session_state:
    st.session_state.chat_input_enabled = False

if "validation_result" not in st.session_state:
    st.session_state.validation_result = None

if "validation_status" not in st.session_state:
    st.session_state.validation_status = None

if "follow_up_questions" not in st.session_state:
    st.session_state.follow_up_questions = []

if "follow_up_answers" not in st.session_state:
    st.session_state.follow_up_answers = []

if "current_question_index" not in st.session_state:
    st.session_state.current_question_index = 0

if "root_cause_analysis" not in st.session_state:
    st.session_state.root_cause_analysis = None

if "compiled_solution" not in st.session_state:
    st.session_state.compiled_solution = None

if "solution_preview_shown" not in st.session_state:
    st.session_state.solution_preview_shown = False

if "waiting_confirmation" not in st.session_state:
    st.session_state.waiting_confirmation = False

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def compile_solution_from_conversation():
    """Compiles solution from conversation history. Input: None (uses session_state). Output: dict with solution_details & root_cause_analysis."""
    initial_solution = st.session_state.compiled_solution or ""
    solution_parts = [initial_solution]
    for answer in st.session_state.follow_up_answers:
        solution_parts.append(answer)
    solution_details = "\n\n".join(solution_parts)
    root_cause = "Root cause analysis based on user responses"
    if st.session_state.follow_up_answers:
        root_cause = st.session_state.follow_up_answers[0] if len(
            st.session_state.follow_up_answers) > 0 else root_cause
    return {
        "solution_details": solution_details,
        "root_cause_analysis": root_cause
    }


def show_solution_preview():
    """Displays formatted solution preview for confirmation. Input: None (uses session_state). Output: Displays in chat, updates session_state.messages."""
    preview_text = f"""**Problem:** {st.session_state.problem_description}

**Root Cause Analysis:** {st.session_state.root_cause_analysis}

**Solution:** {st.session_state.compiled_solution}"""

    with st.chat_message("assistant"):
        st.markdown("Here's a preview of your solution:")
        st.markdown(preview_text)
        st.markdown("\n**Does this look correct?**")

    st.session_state.messages.append({
        "role": "assistant",
        "content": f"Here's a preview of your solution:\n\n{preview_text}\n\n**Does this look correct?**"
    })


def call_backend(endpoint, method="GET", payload=None):
    """Makes HTTP requests to backend API. Input: endpoint (str), method (GET/POST), payload (dict). Output: dict with response or error."""
    try:
        base_url = os.getenv("NODE_SERVER_URL", "http://localhost:3000")
        url = f"{base_url}{endpoint}"
        if method == "GET":
            print(f"Get {url}")
            response = requests.get(url, timeout=10000)
        elif method == "POST":
            print(f"Post {url}, {payload}")
            response = requests.post(url, json=payload, timeout=10000)
        else:
            return {"error": f"Unsupported method: {method}", "code": "INVALID_METHOD"}
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"error": str(e), "code": "REQUEST_ERROR"}
    except Exception as e:
        return {"error": str(e), "code": "UNKNOWN_ERROR"}


# Sidebar: User info input & session management
with st.sidebar:
    st.header("Problem Analysis")
    user_id = st.text_input(
        "Support Agent Name", value=st.session_state.user_id, key="agent_name_input")
    st.session_state.user_id = user_id
    st.divider()
    problem_description = st.text_area(
        "Describe the technical problem",
        value=st.session_state.problem_description or "",
        height=150,
        key="problem_description_input",
        disabled=st.session_state.session_id is not None
    )
    st.divider()
    if st.button("Start Analysis", use_container_width=True, disabled=st.session_state.session_id is not None):
        if not user_id:
            st.error("Please enter your Support Agent Name")
        elif not problem_description.strip():
            st.error("Please describe the technical problem")
        else:
            with st.spinner("Starting analysis..."):
                result = call_backend("/api/chat/start", method="POST", payload={
                                      "user_id": user_id, "problem_description": problem_description.strip()})
            if "error" in result:
                st.error(f"Error: {result.get('error', 'Unknown error')}")
            else:
                st.session_state.session_id = result.get("session_id")
                st.session_state.problem_id = result.get("problem_id")
                st.session_state.problem_description = problem_description.strip()
                st.session_state.current_phase = "waiting_solution"
                ai_message = "How did you solve this problem?"
                st.session_state.messages.append(
                    {"role": "assistant", "content": ai_message})
                st.success("Analysis started! Check the chat area.")
                st.rerun()

    if st.session_state.session_id:
        st.divider()
        if st.button("Reset Session", use_container_width=True):
            st.session_state.session_id = None
            st.session_state.messages = []
            st.session_state.problem_description = None
            st.session_state.problem_id = None
            st.session_state.current_phase = None
            st.session_state.chat_input_enabled = False
            st.session_state.validation_result = None
            st.session_state.validation_status = None
            st.session_state.follow_up_questions = []
            st.session_state.follow_up_answers = []
            st.session_state.current_question_index = 0
            st.session_state.root_cause_analysis = None
            st.session_state.compiled_solution = None
            st.session_state.solution_preview_shown = False
            st.session_state.waiting_confirmation = False
            st.rerun()

# Chat interface: Display messages & handle user input
st.header("Chat Interface")
if st.session_state.messages:
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
else:
    st.info("👋 Enter your details in the sidebar and click 'Start Analysis' to begin.")

# Enable chat input on button click
if st.session_state.current_phase == "waiting_solution" and not st.session_state.chat_input_enabled:
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        if st.button("Describe My Solution", use_container_width=True, type="primary"):
            st.session_state.chat_input_enabled = True
            st.rerun()

chat_placeholder = "Type your message here..." if st.session_state.chat_input_enabled else "Click 'Describe My Solution' to enable chat input"

if prompt := st.chat_input(chat_placeholder, disabled=not st.session_state.chat_input_enabled):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # Phase 2: Solution Validation - Input: user solution, Output: validation result & status
    if st.session_state.current_phase == "waiting_solution" and st.session_state.session_id:
        problem_id = st.session_state.problem_id
        if not problem_id:
            error_msg = "Error: Problem ID not found. Please restart the analysis."
            with st.chat_message("assistant"):
                st.markdown(error_msg)
            st.session_state.messages.append(
                {"role": "assistant", "content": error_msg})
        else:
            with st.chat_message("assistant"):
                with st.spinner("Validating your solution..."):
                    validation_result = call_backend("/api/solutions/validate", method="POST", payload={
                                                     "user_solution": prompt, "problem_id": problem_id})
                if "error" in validation_result:
                    error_msg = f"Error validating solution: {validation_result.get('error', 'Unknown error')}"
                    st.markdown(error_msg)
                    st.session_state.messages.append(
                        {"role": "assistant", "content": error_msg})
                else:
                    validation_data = validation_result.get(
                        "validation_result", {})
                    st.session_state.validation_result = validation_data
                    status = validation_result.get("status")
                    st.session_state.validation_status = status
                    percentage = validation_data.get("percentage", 0)
                    st.session_state.compiled_solution = prompt

                    if status == "matches_existing":
                        existing_count = validation_result.get(
                            "existing_solutions_count", 1)
                        response_msg = f"Your solution matches {existing_count} existing solution{'s' if existing_count != 1 else ''} with {percentage}% confidence. Is this the approach you took?"
                        st.session_state.current_phase = "followups"
                        st.session_state.current_question_index = -1
                        confirmation_msg = "Could you confirm if you followed the exact same steps?"
                        st.markdown(f"\n\n{confirmation_msg}")
                        st.session_state.messages.append(
                            {"role": "assistant", "content": f"{response_msg}\n\n{confirmation_msg}"})
                        st.session_state.current_question_index = -2
                    elif status == "new_solution" or status == "too_generic":
                        response_msg = "This appears to be a novel solution. Can you provide more details?" if status == "new_solution" else "Your solution is quite general. Can you be more specific about the steps you took?"
                        st.session_state.current_phase = "followups"
                        st.session_state.current_question_index = 0
                        st.session_state.follow_up_questions = [
                            "What was the root cause of this problem?",
                            "Can you describe the specific steps you took to resolve it?",
                            "Were there any prerequisites or dependencies needed?"
                        ]
                        first_question = st.session_state.follow_up_questions[0]
                        st.markdown(f"\n\n{first_question}")
                        st.session_state.messages.append(
                            {"role": "assistant", "content": f"{response_msg}\n\n{first_question}"})
                    else:
                        response_msg = "Thank you for providing your solution."

                    if status not in ["new_solution", "too_generic"]:
                        st.markdown(response_msg)
                        st.session_state.messages.append(
                            {"role": "assistant", "content": response_msg})
                    if st.session_state.current_phase != "followups":
                        st.session_state.current_phase = "validating"

    # Phase 3: Follow-Up Questions - Input: follow-up answers, Output: compiled solution & confirmation
    elif st.session_state.current_phase == "followups":
        status = st.session_state.validation_status

        # Follow-up Path 1: Matched solution confirmation
        if status == "matches_existing" and st.session_state.current_question_index == -2:
            user_response_lower = prompt.lower().strip()
            if "yes" in user_response_lower or "yep" in user_response_lower or "correct" in user_response_lower or "right" in user_response_lower:
                with st.chat_message("assistant"):
                    with st.spinner("Saving solution..."):
                        save_result = call_backend("/api/solutions/save", method="POST", payload={"session_id": st.session_state.session_id, "problem_description": st.session_state.problem_description,
                                                   "root_cause_analysis": "Verified match with existing solution", "solution_details": st.session_state.compiled_solution,
                                                   "problem_id": st.session_state.problem_id})
                    if "error" in save_result:
                        error_msg = f"Error saving solution: {save_result.get('error', 'Unknown error')}"
                        st.markdown(error_msg)
                        st.session_state.messages.append(
                            {"role": "assistant", "content": error_msg})
                    else:
                        st.markdown("Solution saved!")
                        st.session_state.messages.append(
                            {"role": "assistant", "content": "Solution saved!"})
                        st.session_state.current_phase = "completed"
                        st.session_state.chat_input_enabled = False
            else:
                with st.chat_message("assistant"):
                    st.markdown(
                        "What were the key differences in your approach?")
                st.session_state.messages.append(
                    {"role": "assistant", "content": "What were the key differences in your approach?"})
                st.session_state.current_question_index = 0
                st.session_state.follow_up_questions = ["What specific steps differed from the existing solution?",
                                                        "Were there any additional considerations?", "What made your approach unique?"]
                st.rerun()

        # Follow-up Path 2: New/Generic solution questions
        elif status in ["new_solution", "too_generic"]:
            if st.session_state.current_question_index < len(st.session_state.follow_up_questions):
                st.session_state.follow_up_answers.append(prompt)
                if st.session_state.current_question_index < len(st.session_state.follow_up_questions) - 1:
                    st.session_state.current_question_index += 1
                    next_question = st.session_state.follow_up_questions[
                        st.session_state.current_question_index]
                    with st.chat_message("assistant"):
                        st.markdown(next_question)
                    st.session_state.messages.append(
                        {"role": "assistant", "content": next_question})
                else:
                    st.session_state.current_question_index += 1
                    compiled = compile_solution_from_conversation()
                    st.session_state.compiled_solution = compiled["solution_details"]
                    st.session_state.root_cause_analysis = compiled["root_cause_analysis"]
                    show_solution_preview()
                    st.session_state.solution_preview_shown = True
                    st.session_state.waiting_confirmation = True
            else:
                if st.session_state.waiting_confirmation:
                    user_response_lower = prompt.lower().strip()
                    if "yes" in user_response_lower or "correct" in user_response_lower or "looks good" in user_response_lower:
                        with st.chat_message("assistant"):
                            with st.spinner("Saving solution..."):
                                save_result = call_backend("/api/solutions/save", method="POST", payload={
                                                           "session_id": st.session_state.session_id, "problem_description": st.session_state.problem_description, "root_cause_analysis": st.session_state.root_cause_analysis, "solution_details": st.session_state.compiled_solution,
                                                           "problem_id": st.session_state.problem_id})
                            if "error" in save_result:
                                error_msg = f"Error saving solution: {save_result.get('error', 'Unknown error')}"
                                st.markdown(error_msg)
                                st.session_state.messages.append(
                                    {"role": "assistant", "content": error_msg})
                            else:
                                st.markdown("Solution saved!")
                                st.session_state.messages.append(
                                    {"role": "assistant", "content": "Solution saved!"})
                                st.session_state.current_phase = "completed"
                                st.session_state.chat_input_enabled = False
                    else:
                        with st.chat_message("assistant"):
                            st.markdown("What would you like to change?")
                        st.session_state.messages.append(
                            {"role": "assistant", "content": "What would you like to change?"})
                        st.session_state.waiting_confirmation = False

    st.rerun()
