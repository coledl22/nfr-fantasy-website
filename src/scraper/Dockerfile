# Use the official Selenium image with Chrome and Python pre-installed
FROM selenium/standalone-chrome:latest

# Set the working directory
WORKDIR /app

# Copy your Python requirements (if any)
COPY ./requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt || true

# Copy your scraper code
COPY ./nfrscraper.py ./nfrscraper.py

# Add entrypoint script for cron and manual run
USER root
RUN apt-get update && apt-get install -y cron
COPY ./entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
# Set up cron to run at midnight (will be overwritten by entrypoint.sh logic)
RUN echo "0 0 * * * root /app/entrypoint.sh >> /var/log/cron.log 2>&1" > /etc/cron.d/nfrscraper-cron
RUN chmod 0644 /etc/cron.d/nfrscraper-cron && crontab /etc/cron.d/nfrscraper-cron
USER seluser
# Default: run entrypoint (runs once, or cron if CRON=1)
ENTRYPOINT ["/app/entrypoint.sh"]
