FROM alpine:3.20

# Install Nginx, OpenSSH server, and htpasswd utility
RUN apk add --no-cache nginx openssh-server openssh-sftp-server apache2-utils

# Create Nginx root directory structures
RUN mkdir -p /var/www/supplier/public \
             /var/www/supplier/bearer \
             /var/www/supplier/apikey \
             /var/www/supplier/basic

# Generate .htpasswd for Basic Auth (supplier_user:supplier_pass)
RUN htpasswd -bc /etc/nginx/.htpasswd supplier_user supplier_pass

# Configure SSH server for password and pubkey authentication
RUN mkdir -p /var/run/sshd \
    && sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config \
    && sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config \
    && echo "Subsystem sftp /usr/lib/ssh/sftp-server" >> /etc/ssh/sshd_config

# Create SFTP users:
# 1. sftpuser (password: sftppass)
RUN adduser -D -s /bin/sh sftpuser \
    && echo "sftpuser:sftppass" | chpasswd \
    && mkdir -p /home/sftpuser/upload

# 2. keyuser (SSH key authentication)
RUN adduser -D -s /bin/sh keyuser \
    && echo "keyuser:keypass" | chpasswd \
    && mkdir -p /home/keyuser/.ssh /home/keyuser/upload

# Copy authorized SSH public key for keyuser
COPY keys/id_rsa.pub /home/keyuser/.ssh/authorized_keys

# Copy files to HTTP server directory
COPY files/feed_public_comma.csv /var/www/supplier/public/feed_public_comma.csv
COPY files/feed_pipe.csv         /var/www/supplier/public/feed_pipe.csv
COPY files/feed_semicolon.csv    /var/www/supplier/public/feed_semicolon.csv
COPY files/feed_catalog.xml      /var/www/supplier/public/feed_catalog.xml
COPY files/feed_malformed.xml    /var/www/supplier/public/feed_malformed.xml
COPY files/feed_bearer.csv       /var/www/supplier/bearer/feed_bearer.csv
COPY files/feed_apikey.csv       /var/www/supplier/apikey/feed_apikey.csv
COPY files/feed_basic.csv        /var/www/supplier/basic/feed_basic.csv

# Copy files to SFTP user upload directories
COPY files/sftp_feed.csv         /home/sftpuser/upload/sftp_feed.csv
COPY files/sftp_feed.csv         /home/keyuser/upload/sftp_feed.csv

# Copy Nginx config and entrypoint
COPY nginx.conf /etc/nginx/nginx.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80 22

ENTRYPOINT ["/entrypoint.sh"]
