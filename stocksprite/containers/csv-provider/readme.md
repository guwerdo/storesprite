docker build -t csvjob .
docker run -d --name csvjob csvjob
docker run -d --name csvjob -v "C:\Temp\csvout\data:/data" csvjob

docker exec -it csvjob /bin/sh