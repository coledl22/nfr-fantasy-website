# NFR Fantasy Website

This project is a web application designed to simulate a fantasy football experience for the National Finals Rodeo (NFR). Users can create teams, manage their rosters, and compete based on the performance of rodeo athletes.

nfr-fantasy-website
├── src
│   ├── index.html        # Main HTML document for the website
│   ├── styles
│   │   └── main.css      # CSS styles for the website
│   └── scripts
│       └── app.js        # JavaScript code for interactivity
## Project Structure

```
nfr-fantasy-website/
├── docker-compose.yml         # Docker Compose configuration
├── Dockerfile                 # Root Dockerfile (if used)
├── README.md                  # Project documentation
└── src/
   ├── backend/               # Node.js/Express backend API
   │   ├── server.js
   │   ├── package.json
   │   ├── eventContestants.json
   │   ├── teams.json
   │   └── users.json
   ├── frontend/              # Static frontend (served by Nginx)
   │   ├── index.html         # Main fantasy app UI
   │   ├── results.html       # Fantasy results UI
   │   ├── nfrresults.html    # Official NFR results viewer
   │   ├── scripts/
   │   │   ├── app.js
   │   │   ├── results.js
   │   │   └── nfrresults.js
   │   ├── styles/
   │   │   └── main.css
   │   └── nginx.conf         # Nginx config for static serving
   └── scraper/               # Python Selenium/BeautifulSoup scraper
      ├── nfrscraper.py      # Scrapes official NFR results
      ├── requirement.txt    # Python dependencies
      └── results/           # Output CSVs (one per event)
         ├── BB_results.csv
         ├── SB_results.csv
         ├── BR_results.csv
         ├── SW_results.csv
         ├── TR_results.csv
         ├── TD_results.csv
         └── GB_results.csv
```

## Getting Started

To get started with the NFR Fantasy Website, follow these steps:

1. **Clone the repository**:
   ```
   git clone <repository-url>
   cd nfr-fantasy-website
   ```

2. **Build and run with Docker Compose**:
   ```
   docker compose up -d --build
   ```

3. **Access the website**:
   Open your web browser and navigate to `http://localhost` (or your Docker host) to view the application.

## Scraper Usage

The official NFR results are scraped using the Python script at `src/scraper/nfrscraper.py`. This script uses Selenium and BeautifulSoup to extract results for all available rounds and events, saving them as CSV files in `src/scraper/results/`.

To run the scraper manually:

```
cd src/scraper
pip install -r requirement.txt
python nfrscraper.py
```

The output CSVs are automatically made available to the frontend for display in the results viewer.

## Adding new years

To add a new year:

1. Create a new `eventContestants.json` file in `src/backend/data/<year>/`.
2. Populate it using the official entry form, available at:  
   `https://www.profantasyrodeo.com/cms/entry-form-download/<year>-nfr-game`  
   (replace `<year>` with the desired year, e.g., `2025`)
3. Ensure the scraper (`src/scraper/nfrscraper.py`) is updated to support the new year and its events.

## Contributing

Contributions are welcome! If you have suggestions for improvements or new features, please open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.