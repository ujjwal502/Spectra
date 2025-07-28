#!/bin/bash

# Spectra Git Hooks Setup Script
# Sets up pre-push hook for automatic Spectra workflow execution

set -e

echo ""
echo "🛠️  ===== Spectra Git Hooks Setup ====="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if we're in a git repository
if [[ ! -d ".git" ]]; then
    echo -e "${RED}❌ Error: Not in a git repository. Please run this from the Spectra project root.${NC}"
    exit 1
fi

# Check if package.json exists
if [[ ! -f "package.json" ]]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this from the Spectra project root.${NC}"
    exit 1
fi

echo -e "${BLUE}Setting up Spectra pre-push hook...${NC}"

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Copy the pre-push hook
if [[ -f ".git/hooks/pre-push" ]]; then
    echo -e "${YELLOW}⚠️  Pre-push hook already exists. Creating backup...${NC}"
    cp .git/hooks/pre-push .git/hooks/pre-push.backup
    echo -e "${BLUE}Backup created: .git/hooks/pre-push.backup${NC}"
fi

# Create the pre-push hook content
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash

# Spectra Pre-Push Hook
# Prompts to run OpenAPI spec generation and intelligent testing before push

set -e

echo ""
echo "🌟 ===== Spectra Pre-Push Hook ====="
echo ""

# Colors for better UX
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to ask yes/no questions
ask_yes_no() {
    local question="$1"
    local response
    
    # Check if we can read from terminal
    if [[ ! -t 0 ]] && [[ ! -r /dev/tty ]]; then
        echo -e "${YELLOW}⚠️  Running in non-interactive mode, defaulting to 'No'${NC}"
        return 1
    fi
    
    while true; do
        echo -e "${BLUE}${question}${NC} ${YELLOW}[y/N]${NC}: "
        # Use /dev/tty to ensure we read from the terminal even in git hook context
        if [[ -r /dev/tty ]]; then
            read -r response < /dev/tty
        else
            read -r response
        fi
        case $response in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            "" ) return 1;;  # Default to No
            * ) echo -e "${RED}Please answer yes (y) or no (n).${NC}";;
        esac
    done
}

# Function to run npm script with error handling
run_npm_script() {
    local script_name="$1"
    local description="$2"
    
    echo ""
    echo -e "${PURPLE}🚀 Running: npm run ${script_name}${NC}"
    echo -e "${BLUE}${description}${NC}"
    echo ""
    
    if npm run "$script_name"; then
        echo ""
        echo -e "${GREEN}✅ Successfully completed: ${script_name}${NC}"
        echo ""
        return 0
    else
        echo ""
        echo -e "${RED}❌ Failed to run: ${script_name}${NC}"
        echo -e "${RED}Push aborted due to script failure.${NC}"
        echo ""
        exit 1
    fi
}

# Function to check if we're in the right directory
check_project_setup() {
    if [[ ! -f "package.json" ]]; then
        echo -e "${RED}❌ Error: package.json not found. Are you in the Spectra project root?${NC}"
        exit 1
    fi
    
    # Check if the required scripts exist using a more reliable method
    if ! grep -q '"generate:spec:demo-api"' package.json; then
        echo -e "${RED}❌ Error: generate:spec:demo-api script not found in package.json${NC}"
        exit 1
    fi
    
    if ! grep -q '"test:demo-api:intelligent"' package.json; then
        echo -e "${RED}❌ Error: test:demo-api:intelligent script not found in package.json${NC}"
        exit 1
    fi
}

# Function to check OpenAI API key
check_openai_key() {
    if [[ -z "$OPENAI_API_KEY" ]]; then
        echo -e "${YELLOW}⚠️  Warning: OPENAI_API_KEY environment variable not set${NC}"
        echo -e "${YELLOW}   AI-powered features may not work properly${NC}"
        echo ""
        
        if ask_yes_no "Continue anyway?"; then
            echo -e "${BLUE}Continuing without OpenAI API key...${NC}"
        else
            echo -e "${RED}Push aborted by user.${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ OpenAI API key found${NC}"
    fi
}

# Function to check if demo API is running
check_demo_api() {
    echo -e "${BLUE}🔍 Checking if demo API is running on http://localhost:8081...${NC}"
    
    if curl -s -f "http://localhost:8081/api/v1/users" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Demo API is running and accessible${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Demo API is not running on http://localhost:8081${NC}"
        echo -e "${YELLOW}   This is required for intelligent testing to work properly${NC}"
        echo ""
        echo -e "${BLUE}To start the demo API:${NC}"
        echo -e "${BLUE}  cd examples/demo-api${NC}"
        echo -e "${BLUE}  mvn spring-boot:run${NC}"
        echo ""
        
        if ask_yes_no "Continue anyway? (Testing may fail)"; then
            echo -e "${YELLOW}Continuing without demo API...${NC}"
            return 1
        else
            echo -e "${RED}Push aborted. Please start the demo API first.${NC}"
            exit 1
        fi
    fi
}

# Main execution flow
main() {
    echo -e "${BLUE}Spectra is about to help you ensure code quality before pushing!${NC}"
    echo ""
    
    # Check project setup
    check_project_setup
    
    # Check OpenAI API key
    check_openai_key
    
    # Step 1: Ask about OpenAPI spec generation
    echo ""
    if ask_yes_no "🔍 Generate OpenAPI spec from demo-api source code?"; then
        run_npm_script "generate:spec:demo-api" "Analyzing demo-api codebase and generating enhanced OpenAPI specification..."
        
        # Step 2: Ask about intelligent testing (only if spec generation was run)
        echo ""
        if ask_yes_no "🧠 Run intelligent API testing workflow?"; then
            # Check if demo API is running
            api_running=true
            check_demo_api || api_running=false
            
            run_npm_script "test:demo-api:intelligent" "Executing comprehensive AI-powered API testing workflow..."
            
            if [[ "$api_running" == "false" ]]; then
                echo -e "${YELLOW}⚠️  Note: Some tests may have failed due to demo API not running${NC}"
            fi
        else
            echo -e "${YELLOW}⏭️  Skipping intelligent testing${NC}"
        fi
    else
        echo -e "${YELLOW}⏭️  Skipping OpenAPI spec generation${NC}"
        echo ""
        
        # Still ask about testing in case they want to test existing specs
        if ask_yes_no "🧠 Run intelligent API testing workflow anyway?"; then
            # Check if demo API is running
            api_running=true
            check_demo_api || api_running=false
            
            run_npm_script "test:demo-api:intelligent" "Executing comprehensive AI-powered API testing workflow..."
            
            if [[ "$api_running" == "false" ]]; then
                echo -e "${YELLOW}⚠️  Note: Some tests may have failed due to demo API not running${NC}"
            fi
        else
            echo -e "${YELLOW}⏭️  Skipping intelligent testing${NC}"
        fi
    fi
    
    echo ""
    echo -e "${GREEN}🎉 Pre-push checks completed successfully!${NC}"
    echo -e "${GREEN}🚀 Proceeding with git push...${NC}"
    echo ""
}

# Run the main function
main

# If we get here, everything succeeded
exit 0
EOF

# Make the hook executable
chmod +x .git/hooks/pre-push

echo -e "${GREEN}✅ Pre-push hook installed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Hook Details:${NC}"
echo -e "${BLUE}  • Location: .git/hooks/pre-push${NC}"
echo -e "${BLUE}  • Triggers on: git push (any push command)${NC}"
echo -e "${BLUE}  • Actions: Prompts for spec generation and testing${NC}"
echo ""
echo -e "${BLUE}🔧 How it works:${NC}"
echo -e "${BLUE}  1. When you run 'git push', the hook activates${NC}"
echo -e "${BLUE}  2. Asks if you want to generate OpenAPI spec${NC}"
echo -e "${BLUE}  3. Asks if you want to run intelligent testing${NC}"
echo -e "${BLUE}  4. Validates environment and dependencies${NC}"
echo -e "${BLUE}  5. Proceeds with push if all checks pass${NC}"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "${YELLOW}  • Set OPENAI_API_KEY environment variable for AI features${NC}"
echo -e "${YELLOW}  • Start demo API (mvn spring-boot:run) for testing${NC}"
echo -e "${YELLOW}  • Use 'git push --no-verify' to skip the hook if needed${NC}"
echo ""
echo -e "${GREEN}🚀 Ready! Try running 'git push' to see the hook in action.${NC}"
echo "" 