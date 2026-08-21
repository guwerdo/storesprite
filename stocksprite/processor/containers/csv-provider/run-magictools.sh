#!/bin/sh
set -e

wget --no-check-certificate -q -O /csv-provider-data/magictools-raw.csv https://media.magictools.hu/shared/products.csv
csvformat -D ',' -d ';' /csv-provider-data/magictools-raw.csv > /csv-provider-data/magictools.csv
echo "$(date): magictools csv conversion completed"
