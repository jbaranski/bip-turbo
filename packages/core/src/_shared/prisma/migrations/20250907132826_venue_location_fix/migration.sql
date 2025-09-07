-- Scenario 1:
-- Update multiple columns to permanently trim data, if trim leads to blank string set column explicit NULL
SELECT COUNT(*)
FROM venues
WHERE (name IS NOT NULL AND (name != TRIM(name) OR name = ''))
OR    (street IS NOT NULL AND (street != TRIM(street) OR street = ''))
OR    (city IS NOT NULL AND (city != TRIM(city) OR city = ''))
OR    (state IS NOT NULL AND (state != TRIM(state) OR state = ''))
OR    (country IS NOT NULL AND (country != TRIM(country) OR country = ''))
OR    (postal_code IS NOT NULL AND (postal_code != TRIM(postal_code) OR postal_code = ''))
OR    (phone IS NOT NULL AND (phone != TRIM(phone) OR phone = ''))
OR    (website IS NOT NULL AND (website != TRIM(website) OR website = ''));

UPDATE venues
SET
    name = NULLIF(TRIM(name), ''),
    street = NULLIF(TRIM(street), ''),
    city = NULLIF(TRIM(city), ''),
    state = NULLIF(TRIM(state), ''),
    country = NULLIF(TRIM(country), ''),
    postal_code = NULLIF(TRIM(postal_code), ''),
    phone = NULLIF(TRIM(phone), ''),
    website = NULLIF(TRIM(website), '')
WHERE (name IS NOT NULL AND (name != TRIM(name) OR name = ''))
OR    (street IS NOT NULL AND (street != TRIM(street) OR street = ''))
OR    (city IS NOT NULL AND (city != TRIM(city) OR city = ''))
OR    (state IS NOT NULL AND (state != TRIM(state) OR state = ''))
OR    (country IS NOT NULL AND (country != TRIM(country) OR country = ''))
OR    (postal_code IS NOT NULL AND (postal_code != TRIM(postal_code) OR postal_code = ''))
OR    (phone IS NOT NULL AND (phone != TRIM(phone) OR phone = ''))
OR    (website IS NOT NULL AND (website != TRIM(website) OR website = ''));

SELECT COUNT(*)
FROM venues
WHERE (name IS NOT NULL AND (name != TRIM(name) OR name = ''))
OR    (street IS NOT NULL AND (street != TRIM(street) OR street = ''))
OR    (city IS NOT NULL AND (city != TRIM(city) OR city = ''))
OR    (state IS NOT NULL AND (state != TRIM(state) OR state = ''))
OR    (country IS NOT NULL AND (country != TRIM(country) OR country = ''))
OR    (postal_code IS NOT NULL AND (postal_code != TRIM(postal_code) OR postal_code = ''))
OR    (phone IS NOT NULL AND (phone != TRIM(phone) OR phone = ''))
OR    (website IS NOT NULL AND (website != TRIM(website) OR website = ''));

-- Scenario 2:
-- Normalize country values for USA and United States, also one venue has CT (Connecticut) as country
SELECT COUNT(*)
FROM venues
WHERE UPPER(country) = 'USA'
OR UPPER(country) = 'CT';

UPDATE venues
SET country = 'United States'
WHERE UPPER(country) = 'USA'
OR UPPER(country) = 'CT';

SELECT COUNT(*)
FROM venues
WHERE UPPER(country) = 'USA'
OR UPPER(country) = 'CT';

-- Scenario 3:
-- Normalize state values from full state names to their respective 2-letter abbreviations for US and Canadian locations
SELECT COUNT(*)
FROM venues
WHERE UPPER(state) IN (
    'ALABAMA', 'ALASKA', 'ARIZONA', 'ARKANSAS', 'CALIFORNIA', 'COLORADO', 'CONNECTICUT', 'DELAWARE', 'DISTRICT OF COLUMBIA', 'FLORIDA', 'GEORGIA', 'HAWAII', 'IDAHO', 'ILLINOIS', 'INDIANA', 'IOWA', 'KANSAS', 'KENTUCKY', 'LOUISIANA', 'MAINE', 'MARYLAND', 'MASSACHUSETTS', 'MICHIGAN', 'MINNESOTA', 'MISSISSIPPI', 'MISSOURI', 'MONTANA', 'NEBRASKA', 'NEVADA', 'NEW HAMPSHIRE', 'NEW JERSEY', 'NEW MEXICO', 'NEW YORK', 'NORTH CAROLINA', 'NORTH DAKOTA', 'OHIO', 'OKLAHOMA', 'OREGON', 'PENNSYLVANIA', 'RHODE ISLAND', 'SOUTH CAROLINA', 'SOUTH DAKOTA', 'TENNESSEE', 'TEXAS', 'UTAH', 'VERMONT', 'VIRGINIA', 'WASHINGTON', 'WEST VIRGINIA', 'WISCONSIN', 'WYOMING',
    'ALBERTA', 'BRITISH COLUMBIA', 'MANITOBA', 'NEW BRUNSWICK', 'NEWFOUNDLAND AND LABRADOR', 'NOVA SCOTIA', 'ONTARIO', 'PRINCE EDWARD ISLAND', 'QUEBEC', 'SASKATCHEWAN', 'NORTHWEST TERRITORIES', 'NUNAVUT', 'YUKON'
);

UPDATE venues
SET state = CASE
    -- US States
    WHEN UPPER(state) = 'ALABAMA' THEN 'AL'
    WHEN UPPER(state) = 'ALASKA' THEN 'AK'
    WHEN UPPER(state) = 'ARIZONA' THEN 'AZ'
    WHEN UPPER(state) = 'ARKANSAS' THEN 'AR'
    WHEN UPPER(state) = 'CALIFORNIA' THEN 'CA'
    WHEN UPPER(state) = 'COLORADO' THEN 'CO'
    WHEN UPPER(state) = 'CONNECTICUT' THEN 'CT'
    WHEN UPPER(state) = 'DELAWARE' THEN 'DE'
    WHEN UPPER(state) = 'DISTRICT OF COLUMBIA' THEN 'DC'
    WHEN UPPER(state) = 'FLORIDA' THEN 'FL'
    WHEN UPPER(state) = 'GEORGIA' THEN 'GA'
    WHEN UPPER(state) = 'HAWAII' THEN 'HI'
    WHEN UPPER(state) = 'IDAHO' THEN 'ID'
    WHEN UPPER(state) = 'ILLINOIS' THEN 'IL'
    WHEN UPPER(state) = 'INDIANA' THEN 'IN'
    WHEN UPPER(state) = 'IOWA' THEN 'IA'
    WHEN UPPER(state) = 'KANSAS' THEN 'KS'
    WHEN UPPER(state) = 'KENTUCKY' THEN 'KY'
    WHEN UPPER(state) = 'LOUISIANA' THEN 'LA'
    WHEN UPPER(state) = 'MAINE' THEN 'ME'
    WHEN UPPER(state) = 'MARYLAND' THEN 'MD'
    WHEN UPPER(state) = 'MASSACHUSETTS' THEN 'MA'
    WHEN UPPER(state) = 'MICHIGAN' THEN 'MI'
    WHEN UPPER(state) = 'MINNESOTA' THEN 'MN'
    WHEN UPPER(state) = 'MISSISSIPPI' THEN 'MS'
    WHEN UPPER(state) = 'MISSOURI' THEN 'MO'
    WHEN UPPER(state) = 'MONTANA' THEN 'MT'
    WHEN UPPER(state) = 'NEBRASKA' THEN 'NE'
    WHEN UPPER(state) = 'NEVADA' THEN 'NV'
    WHEN UPPER(state) = 'NEW HAMPSHIRE' THEN 'NH'
    WHEN UPPER(state) = 'NEW JERSEY' THEN 'NJ'
    WHEN UPPER(state) = 'NEW MEXICO' THEN 'NM'
    WHEN UPPER(state) = 'NEW YORK' THEN 'NY'
    WHEN UPPER(state) = 'NORTH CAROLINA' THEN 'NC'
    WHEN UPPER(state) = 'NORTH DAKOTA' THEN 'ND'
    WHEN UPPER(state) = 'OHIO' THEN 'OH'
    WHEN UPPER(state) = 'OKLAHOMA' THEN 'OK'
    WHEN UPPER(state) = 'OREGON' THEN 'OR'
    WHEN UPPER(state) = 'PENNSYLVANIA' THEN 'PA'
    WHEN UPPER(state) = 'RHODE ISLAND' THEN 'RI'
    WHEN UPPER(state) = 'SOUTH CAROLINA' THEN 'SC'
    WHEN UPPER(state) = 'SOUTH DAKOTA' THEN 'SD'
    WHEN UPPER(state) = 'TENNESSEE' THEN 'TN'
    WHEN UPPER(state) = 'TEXAS' THEN 'TX'
    WHEN UPPER(state) = 'UTAH' THEN 'UT'
    WHEN UPPER(state) = 'VERMONT' THEN 'VT'
    WHEN UPPER(state) = 'VIRGINIA' THEN 'VA'
    WHEN UPPER(state) = 'WASHINGTON' THEN 'WA'
    WHEN UPPER(state) = 'WEST VIRGINIA' THEN 'WV'
    WHEN UPPER(state) = 'WISCONSIN' THEN 'WI'
    WHEN UPPER(state) = 'WYOMING' THEN 'WY'
    -- Canadian Provinces and Territories
    WHEN UPPER(state) = 'ALBERTA' THEN 'AB'
    WHEN UPPER(state) = 'BRITISH COLUMBIA' THEN 'BC'
    WHEN UPPER(state) = 'MANITOBA' THEN 'MB'
    WHEN UPPER(state) = 'NEW BRUNSWICK' THEN 'NB'
    WHEN UPPER(state) = 'NEWFOUNDLAND AND LABRADOR' THEN 'NL'
    WHEN UPPER(state) = 'NOVA SCOTIA' THEN 'NS'
    WHEN UPPER(state) = 'ONTARIO' THEN 'ON'
    WHEN UPPER(state) = 'PRINCE EDWARD ISLAND' THEN 'PE'
    WHEN UPPER(state) = 'QUEBEC' THEN 'QC'
    WHEN UPPER(state) = 'SASKATCHEWAN' THEN 'SK'
    WHEN UPPER(state) = 'NORTHWEST TERRITORIES' THEN 'NT'
    WHEN UPPER(state) = 'NUNAVUT' THEN 'NU'
    WHEN UPPER(state) = 'YUKON' THEN 'YT'
    ELSE state
END
WHERE UPPER(state) IN (
    'ALABAMA', 'ALASKA', 'ARIZONA', 'ARKANSAS', 'CALIFORNIA', 'COLORADO', 'CONNECTICUT', 'DELAWARE', 'DISTRICT OF COLUMBIA', 'FLORIDA', 'GEORGIA', 'HAWAII', 'IDAHO', 'ILLINOIS', 'INDIANA', 'IOWA', 'KANSAS', 'KENTUCKY', 'LOUISIANA', 'MAINE', 'MARYLAND', 'MASSACHUSETTS', 'MICHIGAN', 'MINNESOTA', 'MISSISSIPPI', 'MISSOURI', 'MONTANA', 'NEBRASKA', 'NEVADA', 'NEW HAMPSHIRE', 'NEW JERSEY', 'NEW MEXICO', 'NEW YORK', 'NORTH CAROLINA', 'NORTH DAKOTA', 'OHIO', 'OKLAHOMA', 'OREGON', 'PENNSYLVANIA', 'RHODE ISLAND', 'SOUTH CAROLINA', 'SOUTH DAKOTA', 'TENNESSEE', 'TEXAS', 'UTAH', 'VERMONT', 'VIRGINIA', 'WASHINGTON', 'WEST VIRGINIA', 'WISCONSIN', 'WYOMING',
    'ALBERTA', 'BRITISH COLUMBIA', 'MANITOBA', 'NEW BRUNSWICK', 'NEWFOUNDLAND AND LABRADOR', 'NOVA SCOTIA', 'ONTARIO', 'PRINCE EDWARD ISLAND', 'QUEBEC', 'SASKATCHEWAN', 'NORTHWEST TERRITORIES', 'NUNAVUT', 'YUKON'
);

SELECT COUNT(*)
FROM venues
WHERE UPPER(state) IN (
    'ALABAMA', 'ALASKA', 'ARIZONA', 'ARKANSAS', 'CALIFORNIA', 'COLORADO', 'CONNECTICUT', 'DELAWARE', 'DISTRICT OF COLUMBIA', 'FLORIDA', 'GEORGIA', 'HAWAII', 'IDAHO', 'ILLINOIS', 'INDIANA', 'IOWA', 'KANSAS', 'KENTUCKY', 'LOUISIANA', 'MAINE', 'MARYLAND', 'MASSACHUSETTS', 'MICHIGAN', 'MINNESOTA', 'MISSISSIPPI', 'MISSOURI', 'MONTANA', 'NEBRASKA', 'NEVADA', 'NEW HAMPSHIRE', 'NEW JERSEY', 'NEW MEXICO', 'NEW YORK', 'NORTH CAROLINA', 'NORTH DAKOTA', 'OHIO', 'OKLAHOMA', 'OREGON', 'PENNSYLVANIA', 'RHODE ISLAND', 'SOUTH CAROLINA', 'SOUTH DAKOTA', 'TENNESSEE', 'TEXAS', 'UTAH', 'VERMONT', 'VIRGINIA', 'WASHINGTON', 'WEST VIRGINIA', 'WISCONSIN', 'WYOMING',
    'ALBERTA', 'BRITISH COLUMBIA', 'MANITOBA', 'NEW BRUNSWICK', 'NEWFOUNDLAND AND LABRADOR', 'NOVA SCOTIA', 'ONTARIO', 'PRINCE EDWARD ISLAND', 'QUEBEC', 'SASKATCHEWAN', 'NORTHWEST TERRITORIES', 'NUNAVUT', 'YUKON'
);

-- Scenario 4:
-- Countries are set to state column now, fix those to set the state value to the country column, and null out the state column
SELECT COUNT(*)
FROM venues
WHERE state IS NOT NULL
AND state NOT IN ('',
                  -- US States and DC
                  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
                  -- Canadian Provinces and Territories
                  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'ON', 'PE', 'QC', 'SK', 'NT', 'NU', 'YT');

UPDATE venues
SET country = state,
    state = NULL
WHERE state IS NOT NULL
AND  state NOT IN ('',
                   -- US States and DC
                   'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
                   -- Canadian Provinces and Territories
                   'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'ON', 'PE', 'QC', 'SK', 'NT', 'NU', 'YT');

SELECT COUNT(*)
FROM venues
WHERE state IS NOT NULL
AND state NOT IN ('',
                  -- US States and DC
                  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
                  -- Canadian Provinces and Territories
                  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'ON', 'PE', 'QC', 'SK', 'NT', 'NU', 'YT');

-- Scenario 5:
-- U.K. country to England since the venue is in England
SELECT COUNT(*)
FROM venues
WHERE UPPER(country) IN ('ENGLAND', 'UK', 'U.K.');

UPDATE venues
SET country = 'United Kingdom'
WHERE UPPER(country) IN ('ENGLAND', 'UK', 'U.K.');

SELECT COUNT(*)
FROM venues
WHERE UPPER(country) IN ('ENGLAND', 'UK', 'U.K.');

-- Scenario 6:
-- Set United States as country for all US states
-- Set Canada as country for all Canadian provinces and territories
SELECT COUNT(*)
FROM venues
WHERE (state IN ('AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY')
       AND (country IS NULL OR UPPER(country) != 'UNITED STATES'))
OR (state IN ('AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'ON', 'PE', 'QC', 'SK', 'NT', 'NU', 'YT')
    AND (country IS NULL OR UPPER(country) != 'CANADA'));

UPDATE venues
SET country = CASE
    WHEN state IN ('AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY') THEN 'United States'
    WHEN state IN ('AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'ON', 'PE', 'QC', 'SK', 'NT', 'NU', 'YT') THEN 'Canada'
    ELSE country
END
WHERE (state IN ('AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY')
       AND (country IS NULL OR UPPER(country) != 'UNITED STATES'))
OR (state IN ('AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'ON', 'PE', 'QC', 'SK', 'NT', 'NU', 'YT')
    AND (country IS NULL  OR UPPER(country) != 'CANADA'));

SELECT COUNT(*)
FROM venues
WHERE (state IN ('AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY')
       AND (country IS NULL OR UPPER(country) != 'UNITED STATES'))
OR (state IN ('AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'ON', 'PE', 'QC', 'SK', 'NT', 'NU', 'YT')
    AND (country IS NULL OR UPPER(country) != 'CANADA'));

-- Scenario 7:
-- Fix The Anthem in DC, the city should just be Washington, and state should be DC
-- Also fix any other venues that have city as "Washington DC" or some variation of it (just the Lincoln Theatre)
SELECT count(*)
FROM venues
WHERE (UPPER(city) = 'WASHINGTON, DC' OR UPPER(city) = 'WASHINGTON D.C.' OR UPPER(city) = 'WASHINGTON, D.C.');

UPDATE venues
SET
    street = '901 Wharf St SW',
    city = 'Washington',
    state = 'DC',
    postal_code = '20024',
    country = 'United States'
WHERE id = 'f7f3563e-da6a-40c9-9893-a3a701e4c2f9';

UPDATE venues
SET
    city = 'Washington'
WHERE (UPPER(city) = 'WASHINGTON, DC' OR UPPER(city) = 'WASHINGTON D.C.' OR UPPER(city) = 'WASHINGTON, D.C.');

SELECT count(*)
FROM venues
WHERE (UPPER(city) = 'WASHINGTON, DC' OR UPPER(city) = 'WASHINGTON D.C.' OR UPPER(city) = 'WASHINGTON, D.C.');

-- Scenario 8:
-- Fix Lee's Palace in Toronto, the state should be ON for Ontario and city should just be Toronto
UPDATE venues
SET
    street = '529 Bloor St W',
    city = 'Toronto',
    state = 'ON',
    postal_code = 'M5S 1Y5',
    country = 'Canada'
WHERE id = 'e947a38b-6728-4f2f-8930-78d9982d5b70';

-- Scenario 9:
-- S. Burlington, VT should be South Burlington, VT
SELECT COUNT(*)
FROM venues
WHERE city = 'S. Burlington'
AND state = 'VT';

UPDATE venues
SET city = 'South Burlington'
WHERE city = 'S. Burlington'
AND state = 'VT';

SELECT COUNT(*)
FROM venues
WHERE city = 'S. Burlington'
AND state = 'VT';

-- Scenario 10:
-- St Petersburg, FL should be St. Petersburg, FL
SELECT COUNT(*)
FROM venues
WHERE UPPER(city) = 'ST PETERSBURG'
AND state = 'FL';

UPDATE venues
SET city = 'St. Petersburg'
WHERE UPPER(city) = 'ST PETERSBURG'
AND state = 'FL';

SELECT COUNT(*)
FROM venues
WHERE UPPER(city) = 'ST PETERSBURG'
AND state = 'FL';
