# Force get latest code:
git reset --hard origin/main

# Stocksprite
- use Clerk for auth provider and subscription or payment
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

## Wiremock health check
http://localhost:8090/__admin/health
http://localhost:8090/__admin/mappings

### Test api
http://localhost:8090/api/hello

### Recordings
Add the --record-mappings flag to your ENTRYPOINT or run this command to start recording:
```
curl -X POST http://localhost:8090/__admin/recordings/start \
     -d '{"targetBaseUrl": "https://api.example.com"}'
```
     
### When running integration test reset Wiremock
    ```
    beforeAll(async () => {
      // Tells WireMock to reload all files from the mapped volumes
      await axios.post('http://localhost:8080/__admin/mappings/reset');
    });
    ```