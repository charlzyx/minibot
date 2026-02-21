#!/bin/bash
#
# Minibot Service Uninstallation Script
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SERVICE_NAME="minibot"
INSTALL_DIR="/opt/${SERVICE_NAME}"
USER="${SERVICE_NAME}"

echo "==================================="
echo "Minibot Service Uninstallation"
echo "==================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please use: sudo $0"
    exit 1
fi

# Confirm uninstall
echo -e "${YELLOW}This will:${NC}"
echo "  - Stop and disable the $SERVICE_NAME service"
echo "  - Remove the systemd service file"
echo "  - Optionally remove the installation directory"
echo "  - Optionally remove the $USER user"
echo ""

read -p "Are you sure you want to continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Uninstallation cancelled"
    exit 0
fi

# Stop and disable service
echo -e "${YELLOW}Stopping service...${NC}"
if systemctl is-active --quiet "$SERVICE_NAME"; then
    systemctl stop "$SERVICE_NAME"
    echo -e "${GREEN}✓ Service stopped${NC}"
else
    echo "Service was not running"
fi

echo -e "${YELLOW}Disabling service...${NC}"
if systemctl is-enabled --quiet "$SERVICE_NAME"; then
    systemctl disable "$SERVICE_NAME"
    echo -e "${GREEN}✓ Service disabled${NC}"
else
    echo "Service was not enabled"
fi

# Remove service file
echo -e "${YELLOW}Removing service file...${NC}"
if [ -f "/etc/systemd/system/$SERVICE_NAME.service" ]; then
    rm "/etc/systemd/system/$SERVICE_NAME.service"
    systemctl daemon-reload
    echo -e "${GREEN}✓ Service file removed${NC}"
else
    echo "Service file not found"
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

# Remove user
read -p "Do you want to remove the $USER user? (yes/no): " remove_user
if [ "$remove_user" = "yes" ]; then
    echo -e "${YELLOW}Removing user...${NC}"
    if id "$USER" &>/dev/null; then
        userdel "$USER"
        echo -e "${GREEN}✓ User removed${NC}"
    else
        echo "User not found"
    fi
else
    echo "User preserved: $USER"
fi

echo ""
echo "==================================="
echo -e "${GREEN}Uninstallation Complete!${NC}"
echo "==================================="
