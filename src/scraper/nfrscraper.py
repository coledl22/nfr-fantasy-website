from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup
import time


from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

import os
import csv



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
BASE_URL = "https://www.prorodeo.com/result/2024/2024-wrangler-national-finals-rodeo/15561"
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
    for i, h in enumerate(headers):
        if 'contestant' in h:
            contestant_idx = i
        if 'time' in h or 'score' in h:
            value_idx = i
    if contestant_idx is None or value_idx is None:
        print(f"[ERROR] Could not find contestant or value column in table for event {event_code}")
        return None
    data = []
    for row in table.find_all('tr')[1:]:
        cols = row.find_all('td')
        if cols:
            name = cols[contestant_idx].get_text(strip=True)
            value = cols[value_idx].get_text(strip=True)
            data.append((name, value))
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

# Compute AVG round for each event if missing, using total payoff
def add_avg_round_by_payoff(event_code, rounds):
    if any(str(k).lower() == 'avg' for k in rounds.keys()):
        return
    contestant_values = {}
    round_count = {}
    zero_counts = {}
    for k, results in rounds.items():
        try:
            int_k = int(k)
        except Exception:
            continue
        for tup in results:
            if len(tup) >= 3:
                name, value, place = tup[:3]
            else:
                continue
            try:
                val_clean = value.replace(' s', '').replace('s', '').strip()
                v = float(val_clean)
            except Exception:
                v = 0.0
            key = name
            if event_code == 'TR':
                key = normalize_teamroping_name(name)
            if event_code in ['SW', 'TR', 'TD', 'GB']:
                if v == 0:
                    zero_counts[key] = zero_counts.get(key, 0) + 1
                    continue
            contestant_values.setdefault(key, 0.0)
            round_count.setdefault(key, 0)
            contestant_values[key] += v
            round_count[key] += 1
    avg_results = []
    for key in contestant_values:
        if round_count[key] > 0:
            avg_val = contestant_values[key] / round_count[key]
            if event_code in ['SW', 'TR', 'TD', 'GB']:
                num_zeros = zero_counts.get(key, 0)
                orig_name = None
                for k, results in rounds.items():
                    try:
                        int_k = int(k)
                    except Exception:
                        continue
                    for tup in results:
                        if len(tup) >= 3:
                            name, value, place = tup[:3]
                            if event_code == 'TR':
                                if normalize_teamroping_name(name) == key:
                                    orig_name = name
                                    break
                            else:
                                if name == key:
                                    orig_name = name
                                    break
                    if orig_name:
                        break
                avg_results.append((orig_name or key, f"{avg_val:.2f}", 0, num_zeros))
            else:
                avg_results.append((key, f"{avg_val:.2f}", 0))
    if event_code in ['SW', 'TR', 'TD', 'GB']:
        avg_results_sorted = sorted(avg_results, key=lambda x: (x[3], float(x[1])))
    else:
        reverse = event_code in ['BB', 'SB', 'BR']
        avg_results_sorted = sorted(avg_results, key=lambda x: float(x[1]), reverse=reverse)
    results_with_place = []
    place = 1
    i = 0
    while i < len(avg_results_sorted):
        same = [avg_results_sorted[i]]
        while i + 1 < len(avg_results_sorted) and avg_results_sorted[i+1][1] == avg_results_sorted[i][1] and \
                (event_code not in ['SW', 'TR', 'TD', 'GB'] or avg_results_sorted[i+1][3] == avg_results_sorted[i][3]):
            same.append(avg_results_sorted[i+1])
            i += 1
        for s in same:
            results_with_place.append((s[0], s[1], place))
        place += len(same)
        i += 1
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
    import sys
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
    initial_page = BASE_URL
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


