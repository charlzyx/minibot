#!/bin/bash
#
# Minibot Service Uninstallation Script for macOS
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PLIST_FILE="com.github.charlzyx.minibot.plist"
LAUNCH_DAEMON="/Library/LaunchDaemons/${PLIST_FILE}"
INSTALL_DIR="/opt/minibot"

echo "${BLUE}==================================="
echo "Minibot Service Uninstallation (macOS)"
echo "===================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please use: sudo $0"
    exit 1
fi

# Confirm uninstall
echo -e "${YELLOW}This will:${NC}"
echo "  - Stop and unload the launchd service"
echo "  - Remove the plist file from /Library/LaunchDaemons"
echo "  - Optionally remove the installation directory"
echo ""

read -p "Are you sure you want to continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Uninstallation cancelled"
    exit 0
fi

# Stop and unload service
echo -e "${YELLOW}Stopping service...${NC}"
if launchctl list | grep -q "com.github.charlzyx.minibot"; then
    launchctl unload "$LAUNCH_DAEMON" 2>/dev/null || true
    echo -e "${GREEN}✓ Service stopped and unloaded${NC}"
else
    echo "Service was not loaded"
fi

# Remove plist file
echo -e "${YELLOW}Removing plist file...${NC}"
if [ -f "$LAUNCH_DAEMON" ]; then
    rm "$LAUNCH_DAEMON"
    echo -e "${GREEN}✓ Plist file removed${NC}"
else
    echo "Plist file not found"
fi

# Remove installation directory
read -p "Do you want to remove the installation directory ($INSTALL_DIR)? (yes/no): " remove_dir
if [ "$remove_dir" = "yes" ]; then
    echo -e "${YELLOW}Removing installation directory...${NC}"
    if [ -d "$INSTALL_DIR" ]; then
        rm -rf "$INSTALL_DIR"
        echo -e "${GREEN}✓ Installation directory removed${NC}"
    else
        echo "Installation directory not found"
    fi
else
    echo "Installation directory preserved: $INSTALL_DIR"
fi

echo ""
echo "==================================="
echo -e "${GREEN}Uninstallation Complete!${NC}"
echo "==================================="
