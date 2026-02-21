#!/bin/bash
#
# Minibot Service Installation Script
# This script installs Minibot as a systemd service for auto-start on boot
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVICE_NAME="minibot"
SERVICE_FILE="${SERVICE_NAME}.service"
INSTALL_DIR="/opt/${SERVICE_NAME}"
USER="${SERVICE_NAME}"
GROUP="${SERVICE_NAME}"

echo "==================================="
echo "Minibot Service Installation"
echo "==================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please use: sudo $0"
    exit 1
fi

# Check if systemd is available
if ! command -v systemctl &> /dev/null; then
    echo -e "${RED}Error: systemctl not found. This script requires systemd.${NC}"
    exit 1
fi

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

# Step 1: Create user and group
echo -e "${YELLOW}Step 1: Create user and group${NC}"
if id "$USER" &>/dev/null; then
    echo "User '$USER' already exists"
else
    echo "Creating user '$USER'..."
    useradd -r -s /bin/false -d "$INSTALL_DIR" "$USER"
    echo -e "${GREEN}✓ User '$USER' created${NC}"
fi
echo ""

# Step 2: Create installation directory
echo -e "${YELLOW}Step 2: Setup installation directory${NC}"
if [ -d "$INSTALL_DIR" ]; then
    echo "Directory '$INSTALL_DIR' already exists"
else
    echo "Creating directory '$INSTALL_DIR'..."
    mkdir -p "$INSTALL_DIR"
    echo -e "${GREEN}✓ Directory created${NC}"
fi

# Set ownership
chown -R "$USER:$GROUP" "$INSTALL_DIR"
echo ""

# Step 3: Copy files
echo -e "${YELLOW}Step 3: Copy Minibot files${NC}"
CURRENT_DIR="$(pwd)"

if confirm "Do you want to install from current directory ($CURRENT_DIR)?" "y"; then
    echo "Copying files..."

    # Copy application files
    cp -r dist "$INSTALL_DIR/"
    cp -r node_modules "$INSTALL_DIR/"
    cp package.json "$INSTALL_DIR/"

    # Create workspace directory
    mkdir -p "$INSTALL_DIR"/workspace/{sessions,memory,workspaces,skills,db}

    echo -e "${GREEN}✓ Files copied${NC}"
else
    echo "Please copy the files manually to $INSTALL_DIR"
    echo "Required: dist/, node_modules/, package.json"
fi
echo ""

# Step 4: Install service file
echo -e "${YELLOW}Step 4: Install systemd service${NC}"
if [ -f "$SERVICE_FILE" ]; then
    echo "Installing service file..."
    cp "$SERVICE_FILE" "/etc/systemd/system/"
    systemctl daemon-reload
    echo -e "${GREEN}✓ Service installed${NC}"
else
    echo -e "${RED}Error: Service file '$SERVICE_FILE' not found in current directory${NC}"
    exit 1
fi
echo ""

# Step 5: Configure environment
echo -e "${YELLOW}Step 5: Environment configuration${NC}"
ENV_FILE="$INSTALL_DIR/.env"
if [ -f ".env" ]; then
    echo "Copying .env file..."
    cp .env "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    chown "$USER:$GROUP" "$ENV_FILE"
    echo -e "${GREEN}✓ Environment file copied${NC}"
else
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo "Please create $ENV_FILE with your configuration"
    echo "Required variables: ZHIPU_API_KEY, ZHIPU_BASE_URL, FEISHU_APP_ID, FEISHU_APP_SECRET"
fi
echo ""

# Step 6: Enable and start service
echo -e "${YELLOW}Step 6: Enable and start service${NC}"
systemctl enable "$SERVICE_NAME"
echo ""
echo "Starting service..."
systemctl start "$SERVICE_NAME"
sleep 2

# Check service status
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}✓ Service is running${NC}"
    echo ""
    echo "Service status:"
    systemctl status "$SERVICE_NAME" --no-pager
else
    echo -e "${RED}✗ Service failed to start${NC}"
    echo ""
    echo "Check logs with: journalctl -u $SERVICE_NAME -n 50"
fi
echo ""

# Step 7: Firewall configuration (optional)
echo -e "${YELLOW}Step 7: Firewall configuration${NC}"
if command -v ufw &> /dev/null; then
    if confirm "Do you want to configure firewall (allow port 18791)?" "n"; then
        ufw allow 18791/tcp
        echo -e "${GREEN}✓ Firewall rule added${NC}"
    fi
elif command -v firewall-cmd &> /dev/null; then
    if confirm "Do you want to configure firewall (allow port 18791)?" "n"; then
        firewall-cmd --permanent --add-port=18791/tcp
        firewall-cmd --reload
        echo -e "${GREEN}✓ Firewall rule added${NC}"
    fi
fi
echo ""

# Summary
echo "==================================="
echo -e "${GREEN}Installation Complete!${NC}"
echo "==================================="
echo ""
echo "Service Management Commands:"
echo "  Start:   sudo systemctl start $SERVICE_NAME"
echo "  Stop:    sudo systemctl stop $SERVICE_NAME"
echo "  Restart: sudo systemctl restart $SERVICE_NAME"
echo "  Status:  sudo systemctl status $SERVICE_NAME"
echo "  Logs:    sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "Installation Directory: $INSTALL_DIR"
echo "Service File: /etc/systemd/system/$SERVICE_NAME"
echo ""
