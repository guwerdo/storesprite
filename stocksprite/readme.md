# Stocksprite
- nodejs, typescript, message queue, docker
- reads data from datasource, publishes data to messagequeue
- server update reads data from message queue and updates unas webshop based on the data in the message
- images and description updated once initially `description:1,image:1`
- caches webshop data once a week

# Usage
- `npm run cache:rel` - description
- `npm run pub:rel` - description
- `npm run sub:rel` - description

# Architectire
[image]

# Descriptiopn

# How does it work

# Notes
Install portainer: 
`sudo docker run -d --name portainer --restart=always -p 8000:8000 -p 9443:9443 -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce:2.33.5`
Access: http://192.168.10.248:9443/

Portainer is not always compatible with the latest docker version.
Make sure before installing latest docker or upfrading linux with `apt-get update` that
the docker it installs is supported by portainer.

If not supported downgrade docker or istall a supported version.

