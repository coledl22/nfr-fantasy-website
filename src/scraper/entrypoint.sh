#!/bin/bash
# Entrypoint for nfrscraper Docker container
# If CRON=1, run cron in foreground; otherwise, run scraper once

if [ "$CRON" = "1" ]; then
    # Wait for 10 seconds before first run
    echo "[startup] Waiting 10 seconds before running scraper..."
    sleep 10
    # On container startup, run for the past 4 years (including current year)
    CURYEAR=$(date +%Y)
    for y in $(seq $((CURYEAR-3)) $CURYEAR); do
        echo "[startup] Running nfrscraper.py for year $y..."
        python nfrscraper.py "$y"
    done
    # Set up cron to run only for the current year nightly
    echo "0 0 * * * root python /app/nfrscraper.py \$(date +\%Y) >> /var/log/cron.log 2>&1" > /etc/cron.d/nfrscraper-cron
    chmod 0644 /etc/cron.d/nfrscraper-cron && crontab /etc/cron.d/nfrscraper-cron
    echo "Starting cron for daily scrape at midnight (current year only)..."
    cron -f
else
    # Wait for 10 seconds before first run
    echo "[startup] Waiting 10 seconds before running scraper..."
    sleep 10
    # Allow passing a year as argument
    if [ -n "$1" ]; then
        python nfrscraper.py "$1"
    else
        python nfrscraper.py
    fi
fi
