#!/bin/bash
#
# Minibot Service Installation Script for macOS
# This script installs Minibot as a launchd service for auto-start on boot
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PLIST_FILE="com.github.charlzyx.minibot.plist"
LAUNCH_DAEMON="/Library/LaunchDaemons/${PLIST_FILE}"
INSTALL_DIR="/opt/minibot"
LOG_DIR="$INSTALL_DIR/logs"

echo "${BLUE}==================================="
echo "Minibot Service Installation (macOS)"
echo "===================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please use: sudo $0"
    exit 1
fi

# Get current username
CURRENT_USER="${SUDO_USER:-$USER}"
echo "Current user: $CURRENT_USER"
echo ""

# Function to prompt for yes/no
confirm() {
    local prompt="$1"
    local default="${2:-n}"
    local reply

    if [ "$default" = "y" ]; then
        prompt="$prompt [Y/n]? "
    else
        prompt="$prompt [y/N]? "
    fi

    read -r reply
    reply=${reply:-$default}

    case "$reply" in
        [Yy]*) return 0 ;;
        *) return 1 ;;
    esac
}

# Step 1: Create installation directory
echo -e "${YELLOW}Step 1: Setup installation directory${NC}"
if [ -d "$INSTALL_DIR" ]; then
    echo "Directory '$INSTALL_DIR' already exists"
else
    echo "Creating directory '$INSTALL_DIR'..."
    mkdir -p "$INSTALL_DIR"
    echo -e "${GREEN}✓ Directory created${NC}"
fi

# Set ownership
chown -R "$CURRENT_USER:staff" "$INSTALL_DIR"
echo ""

# Step 2: Create log directory
echo -e "${YELLOW}Step 2: Setup log directory${NC}"
mkdir -p "$LOG_DIR"
chown -R "$CURRENT_USER:staff" "$LOG_DIR"
echo -e "${GREEN}✓ Log directory created${NC}"
echo ""

# Step 3: Copy files
echo -e "${YELLOW}Step 3: Copy Minibot files${NC}"
CURRENT_DIR="$(pwd)"

if [ ! -d "$CURRENT_DIR/dist" ]; then
    echo -e "${RED}Error: dist/ directory not found. Please run 'npm run build' first.${NC}"
    exit 1
fi

echo "Copying files..."
cp -r dist "$INSTALL_DIR/"
cp -r node_modules "$INSTALL_DIR/" 2>/dev/null || true
cp package.json "$INSTALL_DIR/"

# Create workspace directory
mkdir -p "$INSTALL_DIR"/workspace/{sessions,memory,workspaces,skills,db}

echo -e "${GREEN}✓ Files copied${NC}"
echo ""

# Step 4: Configure environment
echo -e "${YELLOW}Step 4: Environment configuration${NC}"
ENV_FILE="$INSTALL_DIR/.env"
if [ -f ".env" ]; then
    echo "Copying .env file..."
    cp .env "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    chown "$CURRENT_USER:staff" "$ENV_FILE"
    echo -e "${GREEN}✓ Environment file copied${NC}"
else
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo "Please create $ENV_FILE with your configuration"
    echo ""
    echo "Required variables:"
    echo "  ZHIPU_API_KEY=your_api_key"
    echo "  ZHIPU_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4"
    echo "  FEISHU_APP_ID=your_app_id"
    echo "  FEISHU_APP_SECRET=your_app_secret"
    echo ""
    read -p "Press Enter to continue after creating .env file..."
fi
echo ""

# Step 5: Configure plist file
echo -e "${YELLOW}Step 5: Configure launchd plist${NC}"
if [ -f "$PLIST_FILE" ]; then
    # Replace YOUR_USERNAME with actual username
    sed "s/YOUR_USERNAME/$CURRENT_USER/g" "$PLIST_FILE" > "/tmp/${PLIST_FILE}"

    # Detect Node.js path
    NODE_PATH=$(which node)
    if [ -n "$NODE_PATH" ]; then
        echo "Detected Node.js at: $NODE_PATH"
        # Update Node.js path in plist
        sed -i '' "s|/usr/local/bin/node|$NODE_PATH|g" "/tmp/${PLIST_FILE}"
    fi

    # Copy to LaunchDaemons
    cp "/tmp/${PLIST_FILE}" "$LAUNCH_DAEMON"
    rm "/tmp/${PLIST_FILE}"

    echo -e "${GREEN}✓ Plist file installed to $LAUNCH_DAEMON${NC}"
else
    echo -e "${RED}Error: Plist file '$PLIST_FILE' not found${NC}"
    exit 1
fi
echo ""

# Step 6: Load and start service
echo -e "${YELLOW}Step 6: Load and start service${NC}"

# Unload if already exists
if launchctl list | grep -q "com.github.charlzyx.minibot"; then
    echo "Service already loaded, unloading first..."
    launchctl unload "$LAUNCH_DAEMON" 2>/dev/null || true
fi

# Load the service
launchctl load "$LAUNCH_DAEMON"
echo -e "${GREEN}✓ Service loaded${NC}"
echo ""

# Start the service
launchctl start "com.github.charlzyx.minibot" 2>/dev/null || echo "Service will start automatically"
echo ""

# Wait and check status
sleep 2
echo "Checking service status..."
if launchctl list | grep -q "com.github.charlzyx.minibot"; then
    echo -e "${GREEN}✓ Service is running${NC}"
    echo ""
    echo "Service details:"
    launchctl list | grep "com.github.charlzyx.minibot"
else
    echo -e "${YELLOW}Service status unknown${NC}"
    echo "Check logs at: $LOG_DIR/minibot.log"
fi
echo ""

# Step 7: Configure firewall (optional)
echo -e "${YELLOW}Step 7: Firewall configuration${NC}"
if confirm "Do you want to allow port 18791 through firewall?" "n"; then
    echo "Note: macOS may prompt you to allow incoming connections"
    echo "when the service starts. Please allow it."
    echo -e "${GREEN}✓ Firewall reminder displayed${NC}"
fi
echo ""

# Summary
echo "==================================="
echo -e "${GREEN}Installation Complete!${NC}"
echo "==================================="
echo ""
echo "Service Management Commands:"
echo "  Start:   sudo launchctl load $LAUNCH_DAEMON"
echo "  Stop:    sudo launchctl unload $LAUNCH_DAEMON"
echo "  Restart: sudo launchctl unload $LAUNCH_DAEMON && sudo launchctl load $LAUNCH_DAEMON"
echo "  Status:  launchctl list | grep minibot"
echo ""
echo "Logs:"
echo "  Output:  $LOG_DIR/minibot.log"
echo "  Error:   $LOG_DIR/minibot.error.log"
echo ""
echo "Installation Directory: $INSTALL_DIR"
echo "Service File: $LAUNCH_DAEMON"
echo ""
