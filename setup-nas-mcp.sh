#!/bin/bash

# Configuration
AGENT_USER="mcp-agent"
PUBLIC_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIL6fJNcwApUjAWbaliz5BGWZYU3msqRGE4mtn8pjdcSg cneue@CNEUEN-BUREAU-3"
WRAPPER_PATH="/usr/local/bin/mcp-omv-wrapper"

echo "🛡️ Configuration de la SÉCURITÉ STRICTE MCP sur le NAS..."

# 1. Création du Wrapper Script (Whitelist de commandes)
cat <<'EOF' > "$WRAPPER_PATH"
#!/bin/bash
# MCP-OMV Wrapper - Strict command whitelist
ACTION=$1

case "$ACTION" in
    "get-system-stats")
        /usr/sbin/omv-rpc -u admin 'System' 'getInformation' '{}'
        ;;
    "list-containers")
        /usr/bin/docker ps --format "{{.Names}} ({{.Status}})"
        ;;
    "get-docker-stats")
        /usr/bin/docker stats --no-stream --format '{{.Name}}:{{.CPUPerc}}:{{.MemPerc}}'
        ;;
    *)
        echo "❌ Error: Command '$ACTION' not allowed." >&2
        exit 1
        ;;
esac
EOF

chmod +x "$WRAPPER_PATH"
chown root:root "$WRAPPER_PATH"
echo "Wrapper script créé et sécurisé dans $WRAPPER_PATH"

# 2. Création de l'utilisateur (si besoin)
if id "$AGENT_USER" &>/dev/null; then
    echo "L'utilisateur $AGENT_USER existe déjà."
else
    useradd -m -s /bin/bash "$AGENT_USER"
    echo "Utilisateur $AGENT_USER créé."
fi

# 3. Configuration SSH
mkdir -p /home/"$AGENT_USER"/.ssh
echo "$PUBLIC_KEY" > /home/"$AGENT_USER"/.ssh/authorized_keys
chown -R "$AGENT_USER":"$AGENT_USER" /home/"$AGENT_USER"/.ssh
chmod 700 /home/"$AGENT_USER"/.ssh
chmod 600 /home/"$AGENT_USER"/.ssh/authorized_keys

# 4. Restriction Sudo (L'agent ne peut lancer QUE le wrapper)
SUDO_FILE="/etc/sudoers.d/mcp-agent"
cat <<EOF > "$SUDO_FILE"
# L'agent MCP ne peut lancer QUE le wrapper script sans mot de passe
$AGENT_USER ALL=(root) NOPASSWD: $WRAPPER_PATH
EOF
chmod 440 "$SUDO_FILE"
echo "Droits sudo restreints au SEUL wrapper script dans $SUDO_FILE."

echo "✅ Configuration STRICTE terminée !"
echo "L'agent SSH pourra uniquement exécuter : sudo $WRAPPER_PATH <action>"
