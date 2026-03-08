#!/bin/bash
set -euo pipefail

# ==========================================
# 🛡️ MCP-NAS: SSH COMMAND WRAPPER MODE
# ==========================================
# If invoked by SSH with a command, act as a transparent logger and executor
if [ -n "${SSH_ORIGINAL_COMMAND:-}" ]; then
    logger -t mcp-nas "Command Executed: $SSH_ORIGINAL_COMMAND"
    eval "$SSH_ORIGINAL_COMMAND"
    exit $?
fi
# ==========================================

# Usage function
usage() {
    echo "Usage: $0 <agent_user> <public_key_string>"
    echo "Example: $0 mcp-agent \"ssh-ed25519 AAA... user@host\""
    exit 1
}

# Configuration from arguments
AGENT_USER=${1:-}
PUBLIC_KEY=${2:-}

if [[ -z "$AGENT_USER" || -z "$PUBLIC_KEY" ]]; then
    usage
fi

if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root to configure sudoers and users."
   exit 1
fi

echo "🛡️ Optimisation SÉCURITÉ HYBRIDE pour $AGENT_USER..."

# 1. Groupes SSH
SSH_GROUP="ssh"
getent group _ssh &>/dev/null && SSH_GROUP="_ssh"
usermod -aG "$SSH_GROUP" "$AGENT_USER"
usermod -U "$AGENT_USER"
usermod -p '*' "$AGENT_USER"

# 2. Permissions
HOME_DIR="/home/$AGENT_USER"
chmod 755 "$HOME_DIR"
mkdir -p "$HOME_DIR/.ssh"
WRAPPER_PATH="/usr/local/bin/mcp-ssh-wrapper.sh"
echo "command=\"$WRAPPER_PATH\",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty $PUBLIC_KEY" > "$HOME_DIR/.ssh/authorized_keys"
chown -R "$AGENT_USER":"$AGENT_USER" "$HOME_DIR/.ssh"
chmod 700 "$HOME_DIR/.ssh"
chmod 600 "$HOME_DIR/.ssh/authorized_keys"

# 3. Sudoers : Wildcards stratégiques pour éviter les erreurs de quotes/caractères
SUDO_FILE="/etc/sudoers.d/mcp-agent"

cat <<'EOF' > "$SUDO_FILE"
# Autoriser les appels OMV-RPC (admin) et Docker PS/STATS/LOGS avec n'importe quels arguments
mcp-agent ALL=(root) NOPASSWD: /usr/sbin/omv-rpc -u admin *
mcp-agent ALL=(root) NOPASSWD: /usr/bin/docker ps *
mcp-agent ALL=(root) NOPASSWD: /usr/bin/docker stats --no-stream --format *
mcp-agent ALL=(root) NOPASSWD: /usr/bin/docker logs *
mcp-agent ALL=(root) NOPASSWD: /usr/bin/docker inspect *
mcp-agent ALL=(root) NOPASSWD: /usr/bin/docker exec *
mcp-agent ALL=(root) NOPASSWD: /usr/bin/journalctl *
mcp-agent ALL=(root) NOPASSWD: /bin/ls *
mcp-agent ALL=(root) NOPASSWD: /usr/bin/tail *
# Gestion Native Docker & Compose
mcp-agent ALL=(root) NOPASSWD: /usr/bin/docker start *
mcp-agent ALL=(root) NOPASSWD: /usr/bin/docker stop *
mcp-agent ALL=(root) NOPASSWD: /usr/bin/docker restart *
mcp-agent ALL=(root) NOPASSWD: /usr/bin/docker pull *
mcp-agent ALL=(root) NOPASSWD: /usr/bin/docker compose *

mcp-agent ALL=(root) NOPASSWD: /usr/sbin/smartctl *
mcp-agent ALL=(root) NOPASSWD: /usr/bin/fail2ban-client *
EOF

if visudo -cf "$SUDO_FILE"; then
    chmod 440 "$SUDO_FILE"
    echo "✅ Sudoers configuré avec succès."
else
    echo "❌ Échec de visudo."
    exit 1
fi

# 4. Déploiement du Wrapper
echo "🔄 Installation du wrapper SSH..."
cp "$0" "$WRAPPER_PATH"
chmod +x "$WRAPPER_PATH"
chown root:root "$WRAPPER_PATH"

echo "🚀 Prêt pour le test final. Toute commande envoyée par l'agent IA sera désormais loguée et restreinte."
