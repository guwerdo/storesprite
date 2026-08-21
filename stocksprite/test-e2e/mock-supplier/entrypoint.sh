#!/bin/sh
set -e

# Generate SSH host keys if not present
ssh-keygen -A

# Ensure correct permissions on SSH keys and user home directories
chmod 700 /home/keyuser/.ssh
chmod 600 /home/keyuser/.ssh/authorized_keys
chown -R keyuser:keyuser /home/keyuser

chmod 755 /home/sftpuser
chown -R sftpuser:sftpuser /home/sftpuser

# Start SSH daemon in background
echo "[mock-supplier] Starting OpenSSH server..."
/usr/sbin/sshd

# Start Nginx in foreground
echo "[mock-supplier] Starting Nginx server..."
exec nginx -g "daemon off;"
