Deploy process
- Run `pack.ps1` to create a package of the application
- Copy the created `./temp/stocksprite.x.x.x.x.zip` file to the remote server
- Copy the created `deploy.sh` file to the remote server.
- Run `chmod +x deploy.sh` on the remote server 
- Run `./deploy.sh <package-file-name.zip>` on the remote server to create the application from the package. Example.: `./deploy.sh stocksprite.1.0.0.32.zip`

