#!/bin/bash

# Usage function
usage() {
    echo "Usage: $0 <agent_user> <public_key_string>"
    echo "Example: $0 mcp-agent \"ssh-ed25519 AAA... user@host\""
    exit 1
}

# Configuration from arguments
AGENT_USER=$1
PUBLIC_KEY=$2

if [[ -z "$AGENT_USER" || -z "$PUBLIC_KEY" ]]; then
    usage
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
echo "$PUBLIC_KEY" > "$HOME_DIR/.ssh/authorized_keys"
chown -R "$AGENT_USER":"$AGENT_USER" "$HOME_DIR/.ssh"
chmod 700 "$HOME_DIR/.ssh"
chmod 600 "$HOME_DIR/.ssh/authorized_keys"

# 3. Sudoers : Wildcards stratégiques pour éviter les erreurs de quotes/caractères
SUDO_FILE="/etc/sudoers.d/mcp-agent"

cat <<'EOF' > "$SUDO_FILE"
# Autoriser les appels OMV-RPC (admin) et Docker PS/STATS/LOGS avec n'importe quels arguments
mcp-agent ALL=(root) NOPASSWD: /usr/sbin/omv-rpc -u admin *
mcp-agent ALL=(root) NOPASSWD: /usr/bin/docker ps --format *
mcp-agent ALL=(root) NOPASSWD: /usr/bin/docker stats --no-stream --format *
mcp-agent ALL=(root) NOPASSWD: /usr/bin/docker logs --since *
mcp-agent ALL=(root) NOPASSWD: /usr/bin/docker exec * cscli decisions list -o json
EOF

if visudo -cf "$SUDO_FILE"; then
    chmod 440 "$SUDO_FILE"
    echo "✅ Sudoers configuré avec succès."
else
    echo "❌ Échec de visudo."
    exit 1
fi

echo "🚀 Prêt pour le test final."
