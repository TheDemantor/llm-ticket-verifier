# Production Startup for Streamlit App

import streamlit as st
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Verify required environment variables
required_vars = ["BACKEND_URL"]
missing_vars = [var for var in required_vars if not os.getenv(var)]

if missing_vars:
    st.error(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
    st.stop()

# Set production configuration
if os.getenv("ENVIRONMENT") == "production":
    st.set_page_config(
        page_title="IT Support Data Quality Verifier",
        page_icon="🔍",
        layout="wide",
        initial_sidebar_state="auto"
    )
else:
    st.set_page_config(
        page_title="IT Support Data Quality Verifier (DEV)",
        page_icon="🔍",
        layout="wide"
    )

# Import main app
from app import main

if __name__ == "__main__":
    main()
