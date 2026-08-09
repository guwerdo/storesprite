# How to run the application locally

# Install redis insight container
`docker run -d --network=stocksprite_default --name redisinsight -p 5540:5540 redis/redisinsight:latest`

When adding a database to redis insight, use the redis container name `redis-stack-test`, `redis-stack-dev`, `redis-stack` instead of `localhost`.

## Manually download data from csv suppliers
The container `stocksprite-csv-provider` contains all csv supplier data.
- Log int to container `csv-downloader-depiend` to download latest csv data and run: `node /app/index.js`. The downloaded csv data will be available for the `stocksprite-csv-provider`. Normally this runs automatically once a day.
- Log int to container `stocksprite-csv-provider` to download latest csv data and run: `python3 /usr/local/bin/getcsv.py > /etc/crontabs/root`. Normally this runs automatically once a day.

## Manually download ezermesterszerszam.csv from unas
use Postman, put the file in `d:\my-git\agrogarden-dev\stocksprite\containers\wiremock\__files\ezermesterszerszam.csv`

### Check the downloaded csv files in csv-provider-data container
- Log in to the container and go to `csv-provider-data` 
- Type `ls -lh` to display all the downloaded CSVs

## Run stocksprite to update the webshop
- Run: `npm run build` to build the whole project.
- Run: `npm run cache:rel` to download the unas database. Exits after run.
- Run: `npm run parse:rel` to check if supplier product is in the webshop database and add the supplier product to the queue.  Exits after run.
- Run: `npm run translate:rel` to read the supplier product from the queue and check if the product stock count matches the webshop stock count if not, create a webshop update request payload and put the payload into the queue. Does not exit after run, it waits for messages from `parse` from the queue.
- Run: `npm run send:rel` to read the queue for payloads and if it founds any product update xml payloads it sends it send is to the webshop to update. Does not exit after run, it waits for messages from `translate` from the queue.


