from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup
import time


from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

import os
import csv
import sys



# ------------------- CONFIG & CONSTANTS -------------------
EVENTS = {
    'BB': 'BB',  # Bareback Riding
    'SW': 'SW',  # Steer Wrestling
    'SB': 'SB',  # Saddle Bronc Riding
    'BR': 'BR',  # Bull Riding
    'TR': 'TR',  # Team Roping
    'TD': 'TD',  # Tie-Down Roping
    'GB': 'GB',  # Barrel Racing
}
EVENT_NAMES = {
    'BB': 'Bareback Riding',
    'SW': 'Steer Wrestling',
    'SB': 'Saddle Bronc Riding',
    'BR': 'Bull Riding',
    'TR': 'Team Roping',
    'TD': 'Tie-down Roping',
    'GB': 'Barrel Racing',
}
BASE_URL_TEMPLATE = "https://www.prorodeo.com/result/2024/2024-wrangler-national-finals-rodeo/15561?eventType=BB&year={year}&resultsTab=grid&round=Avg"
NUM_ROUNDS = 10
AVG_LABELS = ['Avg', 'AVG', 'avg']

# ------------------- UTILITY FUNCTIONS -------------------
def normalize_teamroping_name(n):
    if '/' in n:
        parts = [p.strip().lower() for p in n.split('/')]
        return '/'.join(sorted(parts))
    return n.strip().lower()

def parse_score_or_time(val):
    val = val.replace('s', '').replace('sec', '').replace('seconds', '').strip()
    try:
        return float(val)
    except ValueError:
        try:
            return int(val)
        except ValueError:
            return 0

def extract_table_data(table, event_code):
    headers = [th.get_text(strip=True).lower() for th in table.find_all('th')]
    contestant_idx = None
    value_idx = None
    place_idx = None
    
    for i, h in enumerate(headers):
        if 'contestant' in h:
            contestant_idx = i
        if 'time' in h or 'score' in h:
            value_idx = i
        if 'place' in h or 'pos' in h or h == '#':
            place_idx = i
    
    if contestant_idx is None or value_idx is None:
        print(f"[ERROR] Could not find contestant or value column in table for event {event_code}")
        return None
    
    # Collect all data with place information if available
    raw_data = []
    for row in table.find_all('tr')[1:]:
        cols = row.find_all('td')
        if cols:
            name = cols[contestant_idx].get_text(strip=True)
            value = cols[value_idx].get_text(strip=True)
            place = cols[place_idx].get_text(strip=True) if place_idx is not None and place_idx < len(cols) else ""
            raw_data.append((name, value, place))
    
    # Filter out duplicates - keep entries with valid places, remove ones with "--" or no place
    contestant_entries = {}
    for name, value, place in raw_data:
        if name not in contestant_entries:
            contestant_entries[name] = []
        contestant_entries[name].append((value, place))
    
    # For each contestant, if multiple entries exist, keep the one with a valid place
    data = []
    for name, entries in contestant_entries.items():
        if len(entries) == 1:
            # Only one entry, keep it regardless of place
            data.append((name, entries[0][0]))
        else:
            # Multiple entries - prefer the one with a valid place (not "--" or empty)
            valid_entries = [(value, place) for value, place in entries if place and place != "--" and place.strip() != ""]
            if valid_entries:
                # Keep the first valid entry (they should all be the same if valid)
                data.append((name, valid_entries[0][0]))
            else:
                # No valid places found, keep the first entry
                data.append((name, entries[0][0]))
    
    return data

def calculate_places(event_code, data):
    reverse = event_code in ['BB', 'SB', 'BR']
    parsed = [(name, parse_score_or_time(value), value) for name, value in data]
    nonzero = [x for x in parsed if x[1] > 0]
    zero = [x for x in parsed if x[1] == 0]
    nonzero_sorted = sorted(nonzero, key=lambda x: x[1], reverse=reverse)
    results = []
    place = 1
    i = 0
    while i < len(nonzero_sorted):
        same = [nonzero_sorted[i]]
        while i + 1 < len(nonzero_sorted) and nonzero_sorted[i+1][1] == nonzero_sorted[i][1]:
            same.append(nonzero_sorted[i+1])
            i += 1
        for s in same:
            results.append((s[0], s[2], place))
        place += len(same)
        i += 1
    for z in zero:
        results.append((z[0], z[2], 16))
    return results

def write_event_csv(results_dir, year, all_results):
    results_dir = os.path.join(os.path.dirname(__file__), f"results/{year}")
    try:
        os.makedirs(results_dir, exist_ok=True)
    except Exception as e:
        print(f"[ERROR] Could not create results directory {results_dir}: {e}")
        return
    for event_code, rounds in all_results.items():
        outpath = os.path.join(results_dir, f"{event_code}_results.csv")
        try:
            with open(outpath, "w", newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(["Round", "Contestant", "Time/Score", "Place"])
                def round_sort_key(item):
                    k = item[0]
                    if isinstance(k, int):
                        return (0, k)
                    try:
                        return (0, int(k))
                    except Exception:
                        return (1, str(k).lower())
                for round_num, results in sorted(rounds.items(), key=round_sort_key):
                    for name, value, place in results:
                        writer.writerow([round_num, name, value, place])
        except Exception as e:
            print(f"[ERROR] Could not write CSV for {event_code} to {outpath}: {e}")


# Helper to select a dropdown option by visible text
def select_dropdown_by_text(selection_text, dropdown_index):
    try:
        # Find all dropdowns (Round, Event, Year)
        dropdowns = driver.find_elements(By.CLASS_NAME, "v-select__selection")
        dropdown = dropdowns[dropdown_index]
        # Check if already selected
        current_value = dropdown.text.strip()
        target = selection_text.strip()
        if current_value == target:
            return True
        dropdown.click()
        time.sleep(0.1)  # Give time for options to render

        # Wait for at least one option to appear
        try:
            WebDriverWait(driver, 1).until(
                EC.visibility_of_element_located((By.CLASS_NAME, "v-list-item__title"))
            )
        except Exception:
            pass
        # Use XPath to find only visible options
        options = driver.find_elements(By.XPATH, "//div[contains(@class,'v-list-item__title') and not(ancestor::div[contains(@style,'display: none')])]" )
        if not options:
            print("[DEBUG] No options found with XPath, trying JS click fallback.")
            driver.execute_script("arguments[0].click();", dropdown)
            time.sleep(0.1)
            options = driver.find_elements(By.XPATH, "//div[contains(@class,'v-list-item__title') and not(ancestor::div[contains(@style,'display: none')])]" )
        target = selection_text.strip()
        for option in options:
            if option.text.strip().lower() == target.lower():
                option.click()
                # Wait longer for year dropdown (index 2), which loads slowly
                if dropdown_index == 2:
                    time.sleep(2)
                else:
                    time.sleep(0.1)  # Let table update
                return True
        print(f"Option '{selection_text}' not found in dropdown {dropdown_index}")
        return False
    except Exception as e:
        print(f"Dropdown selection error: {e}")
        return False


def scrape_event_round(event_code, round_num, driver, year, results_dict=None):
    round_text = f"Round {round_num}"
    event_text = EVENT_NAMES[event_code]
    year_text = str(year)
    failed = False
    if not select_dropdown_by_text(round_text, 0):
        print(f"[ERROR] Failed to select round {round_text}")
        failed = True
    elif not select_dropdown_by_text(event_text, 1):
        print(f"[ERROR] Failed to select event {event_text}")
        failed = True
    elif not select_dropdown_by_text(year_text, 2):
        print(f"[ERROR] Failed to select year {year_text}")
        failed = True
    if failed:
        print("[ERROR] Reloading page")
        driver.refresh()
        time.sleep(3)
        return
    # Wait for table to update (poll for up to 10s)
    table = None
    start_time = time.time()
    while time.time() - start_time < 10:
        html = driver.page_source
        soup = BeautifulSoup(html, 'html.parser')
        table = soup.find('table', class_='sa-common-vgt-table__table')
        if table:
            break
    if not table:
        print(f"[ERROR] No table found for {event_code} Round {round_num} after waiting 10s")
        return
    data = extract_table_data(table, event_code)
    if data is None:
        print(f"[ERROR] Could not find Contestant or Time/Score columns for {event_code} Round {round_num}")
        return
    results = calculate_places(event_code, data)
    if results_dict is not None:
        results_dict.setdefault(event_code, {})[round_num] = results
    else:
        for r in results:
            print(f"{event_code} Round {round_num}: {r[0]} - {r[1]} - Place {r[2]}")


def get_dropdown_options(dropdown_index):

    # Dynamically get available rounds from the dropdown, including AVG if present
    dropdowns = driver.find_elements(By.CLASS_NAME, "v-select__selection")
    if len(dropdowns) < 2:
        print("[ERROR] Could not find enough dropdowns on the page.")
        driver.quit()
        exit(1)

    dropdowns = driver.find_elements(By.CLASS_NAME, "v-select__selection")
    dropdown = dropdowns[dropdown_index]
    dropdown.click()
    time.sleep(0.2)
    options = driver.find_elements(By.XPATH, "//div[contains(@class,'v-list-item__title') and not(ancestor::div[contains(@style,'display: none')])]" )
    option_texts = [opt.text.strip() for opt in options if opt.text.strip()]
    driver.refresh()
    time.sleep(1)
    return option_texts

# Compute AVG round for each event if missing, using average of contestant's scores
def add_avg_round_by_payoff(event_code, rounds):
    # Check if AVG round already exists - if so, don't recalculate
    if any(str(k).lower() == 'avg' for k in rounds.keys()):
        return
    
    # Initialize dictionaries to track contestant performance
    contestant_values = {}  # Sum of all scores for each contestant
    round_count = {}       # Number of rounds each contestant participated in
    zero_counts = {}       # Number of zero scores
    
    # Process all rounds to accumulate scores for each contestant
    for k, results in rounds.items():
        # Only process numeric round keys (skip non-round entries)
        try:
            int_k = int(k)
        except Exception:
            continue
            
        # Process each contestant's result in this round
        for tup in results:
            # Extract name, score/time, and place from result tuple
            if len(tup) >= 3:
                name, value, place = tup[:3]
            else:
                continue
                
            # Clean and parse the score/time value
            try:
                val_clean = value.replace(' s', '').replace('s', '').strip()
                v = float(val_clean)
            except Exception:
                v = 0.0
                
            # Use contestant name as key, normalize for team roping
            key = name
            if event_code == 'TR':
                key = normalize_teamroping_name(name)
            
            # These don't count toward averages but are tracked for tie-breaking
            if v == 0:
                zero_counts[key] = zero_counts.get(key, 0) + 1
            
            # Add score to contestant's total and increment round count
            contestant_values.setdefault(key, 0.0)
            round_count.setdefault(key, 0)
            contestant_values[key] += v
            round_count[key] += 1
    
    # Calculate averages and create result tuples
    avg_results = []
    no_score_contestants = []
    
    # Collect all contestants who appear in any round (including those with all zeros)
    all_contestants = set()
    for k, results in rounds.items():
        try:
            int_k = int(k)
        except Exception:
            continue
        for tup in results:
            if len(tup) >= 3:
                name, value, place = tup[:3]
                key = name
                if event_code == 'TR':
                    key = normalize_teamroping_name(name)
                all_contestants.add((key, name))
    
    for key, orig_name in all_contestants:
        # Calculate average of all non-zero scores
        num_zeros = zero_counts.get(key, 0)
        scoring_rounds = round_count[key] - num_zeros
        if scoring_rounds > 0:
            avg_val = contestant_values[key] / scoring_rounds
        else:
            avg_val = 0

        if round_count[key] == num_zeros:
            no_score_contestants.append((orig_name, "0.00/0", 16))
        else:
            # Format: (name, "avg_score/scoring_rounds", temp_place, zero_count)
            avg_results.append((orig_name, f"{avg_val:.2f}/{scoring_rounds}", 0, num_zeros))
    
    # Sort results based on event type
    if event_code in ['SW', 'TR', 'TD', 'GB']:
        # Timed events: sort by zero count first, then by time (lower is better)
        # Contestants with more zeros are ranked lower
        avg_results_sorted = sorted(avg_results, key=lambda x: (x[3], float(x[1].split('/')[0])))
    else:
        # Scored events: sort by lowest zero count first, then by highest score
        # Higher scores are better, fewer zeros are better
        avg_results_sorted = sorted(avg_results, key=lambda x: (x[3], -float(x[1].split('/')[0])))

    # Assign places, handling ties appropriately
    results_with_place = []
    place = 1
    i = 0
    while i < len(avg_results_sorted):
        # Find all contestants with the same score/time and zero count
        same = [avg_results_sorted[i]]
        while i + 1 < len(avg_results_sorted) and avg_results_sorted[i+1][1] == avg_results_sorted[i][1] and \
                (event_code not in ['SW', 'TR', 'TD', 'GB'] or avg_results_sorted[i+1][3] == avg_results_sorted[i][3]):
            same.append(avg_results_sorted[i+1])
            i += 1
        
        # Assign the same place to all tied contestants
        for s in same:
            results_with_place.append((s[0], s[1], place))
        
        # Next place is incremented by the number of tied contestants
        place += len(same)
        i += 1
    
    # Add contestants with no valid scores (all zeros) to the final results
    results_with_place.extend(no_score_contestants)
    
    # Add the calculated AVG round to the rounds dictionary
    if results_with_place:
        rounds['Avg'] = results_with_place

def write_all_results_to_csv(all_results, year):
    """Write all event results to CSV files in results/{year}/ directory."""
    results_dir = os.path.join(os.path.dirname(__file__), f"results/{year}")
    try:
        os.makedirs(results_dir, exist_ok=True)
    except Exception as e:
        print(f"[ERROR] Could not create results directory {results_dir}: {e}")
        return
    for event_code, rounds in all_results.items():
        outpath = os.path.join(results_dir, f"{event_code}_results.csv")
        try:
            with open(outpath, "w", newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(["Round", "Contestant", "Time/Score", "Place"])
                def round_sort_key(item):
                    k = item[0]
                    # Numeric rounds first, then AVG (or any string) after
                    if isinstance(k, int):
                        return (0, k)
                    try:
                        # Try to convert to int if string like '1', '2', etc.
                        return (0, int(k))
                    except Exception:
                        return (1, str(k).lower())
                for round_num, results in sorted(rounds.items(), key=round_sort_key):
                    for name, value, place in results:
                        writer.writerow([round_num, name, value, place])
        except Exception as e:
            print(f"[ERROR] Could not write CSV for {event_code} to {outpath}: {e}")



if __name__ == "__main__":
    all_results = {}

    # Parse year from command line
    if len(sys.argv) > 1:
        try:
            year = int(sys.argv[1])
        except Exception:
            print(f"[ERROR] Invalid year argument: {sys.argv[1]}")
            sys.exit(1)
    else:
        year = 2024

    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--log-level=3')
    global driver
    driver = webdriver.Chrome(options=options)
    initial_page = BASE_URL_TEMPLATE.format(year=year)
    if initial_page:
        driver.get(initial_page)
        time.sleep(2)
    round_options = get_dropdown_options(0)
    round_keys = []
    for r in round_options:
        if r.lower().startswith("round"):
            try:
                round_keys.append(int(r.split()[-1]))
            except Exception:
                pass
        # Leave code to add AVG if we want to add this back in the future.
        elif r.strip().upper() == "AVG":
            continue
            #round_keys.append("Avg")
    for event_code in EVENTS:
        for round_key in round_keys:
            scrape_event_round(event_code, round_key, driver, year, results_dict=all_results)

    driver.quit()

    for event_code, rounds in all_results.items():
        add_avg_round_by_payoff(event_code, rounds)

    write_all_results_to_csv(all_results, year)


