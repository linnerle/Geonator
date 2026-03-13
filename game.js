// ============================================
// CANDIDATES LIST UI
// ============================================

// Returns true if a candidate's place matches the given question (same logic as processAnswer)
function doesCandidateMatchQuestion(candidate, question) {
    if (!question) return false;
    const place = candidate.place;
    if (question.type === 'fclass') {
        return place.fclass === question.value;
    } else if (question.type === 'fclass_group') {
        return question.matches.includes(place.fclass);
    } else if (question.type === 'city') {
        return place.city === question.value;
    } else if (question.type === 'city_region') {
        if (place.county === question.county && place.city && Array.isArray(place.coordinates) && place.coordinates.length >= 2) {
            const [lng, lat] = place.coordinates;
            if (question.axis === 'ns') return question.regionValue === 'north' ? lat >= question.threshold : lat < question.threshold;
            if (question.axis === 'ew') return question.regionValue === 'east' ? lng >= question.threshold : lng < question.threshold;
        }
        return false;
    } else if (question.type === 'geo_split') {
        if (Array.isArray(place.coordinates) && place.coordinates.length >= 2) {
            const [lng, lat] = place.coordinates;
            if (question.axis === 'ns') return question.regionValue === 'north' ? lat >= question.threshold : lat < question.threshold;
            if (question.axis === 'ew') return question.regionValue === 'east' ? lng >= question.threshold : lng < question.threshold;
        }
        return false;
    } else if (question.type === 'county') {
        return place.county === question.value;
    } else if (question.type === 'ambiguous') {
        return question.matches.includes(place.fclass);
    } else if (question.type === 'name_pattern') {
        const nameLower = place.name.toLowerCase();
        const patternLower = question.pattern.toLowerCase();
        if (question.fclass) {
            if (place.fclass !== question.fclass) return false;
            if (patternLower.includes('|')) return patternLower.split('|').some(p => nameLower.includes(p.trim()));
            return nameLower.includes(patternLower);
        }
        if (patternLower.includes('|')) return patternLower.split('|').some(p => nameLower.includes(p.trim()));
        if (question.prefix) return nameLower.startsWith(patternLower) || nameLower.startsWith(patternLower.replace('.', ''));
        return nameLower.includes(patternLower);
    } else if (question.type === 'name_token') {
        const nameLower = String(place.name || '').toLowerCase();
        const tokenLower = String(question.token || question.value || '').toLowerCase();
        return tokenLower.length > 0 && nameLower.includes(tokenLower);
    } else if (question.type === 'name_prefix') {
        const firstWord = String(place.name || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/)[0] || '';
        const prefixLower = String(question.prefix || question.value || '').toLowerCase();
        return prefixLower.length > 0 && firstWord === prefixLower;
    } else if (question.type === 'relationship') {
        return place.relationship === question.value;
    } else if (question.type === 'relationship_group') {
        return question.matches && question.matches.includes(place.relationship);
    } else if (question.type === 'region') {
        if (place.county && gameState.counties.features) {
            const countyData = gameState.counties.features.find(
                c => (c.properties?.NAME || c.properties?.name) === place.county
            );
            if (countyData) {
                if (question.axis === 'ns') return countyData.region_ns === question.value;
                if (question.axis === 'ew') return countyData.region_ew === question.value;
            }
        }
        return false;
    }
    return false;
}

function updateCandidatesList(question) {
    const listElem = document.getElementById('candidatesList');
    const panelElem = document.querySelector('.candidates-list-panel');
    const titleElem = document.querySelector('.candidates-list-title');
    if (!listElem) return;

    // Keep county/city/place finder synchronized with currently viable candidates
    refreshLocationFinder();

    // If a question is provided, show which candidates would match a "Yes" answer
    if (question && question.type !== 'guess') {
        const matching = gameState.candidates.filter(c => doesCandidateMatchQuestion(c, question));
        const total = gameState.candidates.length;

        // Only show the panel when there are 25 or fewer matching candidates
        if (matching.length <= 25) {
            if (panelElem) panelElem.style.display = 'flex';
            const showCount = Math.min(matching.length, 25);

            if (titleElem) {
                titleElem.textContent = `Yes: ${matching.length} of ${total}`;
                titleElem.classList.add('question-mode');
            }

            listElem.innerHTML = '';
            listElem.classList.remove('candidates-list-few-bg');

            if (matching.length === 0) {
                const li = document.createElement('li');
                li.innerHTML = `<span class="candidates-list-name" style="color:#aaa;font-style:italic;">None match</span>`;
                listElem.appendChild(li);
                return;
            }

            // Sort matching by probability descending
            const sorted = [...matching].sort((a, b) => b.probability - a.probability);
            const allSameName = showCount > 1 && sorted.slice(0, showCount).every(c => c.place.name === sorted[0].place.name);

            sorted.slice(0, showCount).forEach((c, i) => {
                const li = document.createElement('li');
                let extra = '';
                if (c.place.city) extra += `, <span class='candidates-list-city'>${c.place.city}</span>`;
                if (c.place.county) extra += ` <span class='candidates-list-county'>(${c.place.county} Co.)</span>`;
                const nameCount = sorted.slice(0, showCount).filter(x => x.place.name === c.place.name).length;
                const showDetails = allSameName || nameCount > 1;
                li.innerHTML = `<span class="candidates-list-rank">${i+1}.</span><span class="candidates-list-name">${c.place.name}${showDetails ? extra : ''}</span>`;
                listElem.appendChild(li);
            });
        } else {
            // Too many matches to display
            if (panelElem) panelElem.style.display = 'none';
        }
        return;
    }

    // Default mode: show top candidates by probability
    const totalCandidates = gameState.candidates.length;

    // Only show panel when there are 20 or fewer candidates
    if (totalCandidates > 20) {
        if (panelElem) panelElem.style.display = 'none';
        listElem.innerHTML = '';
        listElem.classList.remove('candidates-list-few-bg');
        return;
    } else {
        if (panelElem) panelElem.style.display = 'flex';
    }

    if (titleElem) {
        titleElem.textContent = 'Remaining Candidates';
        titleElem.classList.remove('question-mode');
    }

    // Sort by probability descending
    const sorted = [...gameState.candidates].sort((a, b) => b.probability - a.probability);
    listElem.innerHTML = '';
    const showCount = Math.min(sorted.length, 20);
    const allSameName = showCount > 1 && sorted.slice(0, showCount).every(c => c.place.name === sorted[0].place.name);
    sorted.slice(0, showCount).forEach((c, i) => {
        const li = document.createElement('li');
        let extra = '';
        if (c.place.city) extra += `, <span class='candidates-list-city'>${c.place.city}</span>`;
        if (c.place.county) extra += ` <span class='candidates-list-county'>(${c.place.county} Co.)</span>`;
        let showDetails = allSameName;
        if (!showDetails) {
            const nameCount = sorted.slice(0, showCount).filter(x => x.place.name === c.place.name).length;
            showDetails = nameCount > 1;
        }
        li.innerHTML = `<span class="candidates-list-rank">${i+1}.</span><span class="candidates-list-name">${c.place.name}${showDetails ? extra : ''}</span><span class="candidates-list-score">${(c.probability*100).toFixed(2)}%</span>`;
        if (showCount <= 5) li.classList.add('candidates-list-few');
        listElem.appendChild(li);
    });
    if (showCount <= 5) {
        listElem.classList.add('candidates-list-few-bg');
    } else {
        listElem.classList.remove('candidates-list-few-bg');
    }
}
// ============================================
// GAME STATE & DATA
// ============================================

const CITY_OUTLINE_BUFFER_MILES = 3;
const CITY_FALLBACK_MAX_DISTANCE_MILES = 10;
const CITY_BOUNDARY_OVERRIDE_MILES = 2.5;
const MAIN_PLACE_SOURCE_FILES = [
    'data/all_pois.geojson',
    'data/all_pofw.geojson',
    'data/all_transport.geojson'
];
const EXCLUDED_PLACE_TYPES = [
    'hamlet',
    'tourist_info',
    'information',
    'camera_surveillance',
    'doityourself',
    'car_parts',
    'trade',
    'beverages',
    'outdoor_shop',
    'carpet',
    'curtain',
    'fabric',
    'locksmith',
    'travelagency',
    'glaziery',
    'photo',
    'second_hand',
    'variety_store'
];

const MARKER_RENDER_CHUNK_SIZE = 1200;
const MAX_INITIAL_MARKER_TOOLTIPS = 1200;
const MAX_CANDIDATE_MARKER_TOOLTIPS = 2000;
const PROGRESSIVE_TOP_FIRST_RENDER = true;
const PLACE_EXTRACTION_CHUNK_SIZE = 600;

let gameState = {
    places: [],              // All places from the GeoJSON POI sources
    cities: [],              // All cities from ga_cities.json
    counties: [],            // All counties from ga_counties.geojson
    placesByCity: new Map(), // Map from lowercase city name → places tagged with that city
    candidates: [],          // Current candidate places with probabilities
    decisionTree: [],        // Array of {question, answer} objects
    questionCount: 0,        // Number of questions asked
    maxQuestions: 20,        // Maximum questions allowed
    gameActive: false,       // Whether game is in progress
    map: null,              // Leaflet map instance
    markers: null,          // Leaflet marker layer (for points)
    polygons: null,         // Leaflet polygon layer (for areas)
    regionHighlights: null, // Leaflet layer for region question highlights
    askedQuestions: [],     // Track questions already asked this game
    isGuessing: false,      // Whether we're in guessing mode
    locationQuestionsAsked: 0,  // Track city/county questions
    undoStack: [],           // Store undo history for multi-step undo
    previousCandidateCount: 0,  // Track candidate changes
    cityBoundaries: new Map(),   // Map from lowercase city name → synthesized outline feature
    currentGuessLabel: null,
    currentGuessGroup: null,
    finderMarker: null,
    finderCountyOutline: null,
    pointRenderer: null,
    mapRenderToken: 0
};

let locationFinderState = {
    visiblePlaces: [],
    searchMatches: [],
    currentMatchIndex: -1,
    searchTerm: ''
};

function clearFinderSearchState() {
    locationFinderState.searchMatches = [];
    locationFinderState.currentMatchIndex = -1;
    locationFinderState.searchTerm = '';
}

function normalizeCountyName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/\s+county$/, '')
        .trim();
}

function clearFinderCountyOutline() {
    if (gameState.map && gameState.finderCountyOutline) {
        gameState.map.removeLayer(gameState.finderCountyOutline);
    }
    gameState.finderCountyOutline = null;
}

function updateFinderCountyOutline(countyName) {
    clearFinderCountyOutline();

    if (!countyName || !gameState.map || !gameState.counties || !Array.isArray(gameState.counties.features)) {
        return;
    }

    const target = normalizeCountyName(countyName);
    const countyFeature = gameState.counties.features.find(feature => {
        const featureName = feature.properties?.NAME || feature.properties?.name;
        return normalizeCountyName(featureName) === target;
    });

    if (!countyFeature) return;

    gameState.finderCountyOutline = L.geoJSON(countyFeature, {
        style: {
            fill: false,
            color: '#0039A6',
            weight: 3,
            opacity: 0.95,
            dashArray: null
        }
    }).addTo(gameState.map);
}

function updateFinderNavigationUI() {
    const prevBtn = document.getElementById('finderPrevBtn');
    const nextBtn = document.getElementById('finderNextBtn');
    const status = document.getElementById('finderNavStatus');
    const hasMatches = locationFinderState.searchMatches.length > 0;
    const multipleMatches = locationFinderState.searchMatches.length > 1;

    if (prevBtn) prevBtn.disabled = !multipleMatches;
    if (nextBtn) nextBtn.disabled = !multipleMatches;

    if (!status) return;
    if (!hasMatches) {
        status.textContent = 'No active search';
        return;
    }

    const current = locationFinderState.currentMatchIndex + 1;
    const total = locationFinderState.searchMatches.length;
    status.textContent = `Match ${current} of ${total} for "${locationFinderState.searchTerm}"`;
}

function focusFinderMatchAtIndex(index) {
    const total = locationFinderState.searchMatches.length;
    if (total === 0) return;

    const wrapped = ((index % total) + total) % total;
    locationFinderState.currentMatchIndex = wrapped;
    focusFinderPlace(locationFinderState.searchMatches[wrapped]);
    updateFinderNavigationUI();
}

function navigateFinderMatch(step) {
    if (locationFinderState.searchMatches.length < 2) return;
    focusFinderMatchAtIndex(locationFinderState.currentMatchIndex + step);
}

function getViablePlacesForFinder() {
    if (Array.isArray(gameState.candidates) && gameState.candidates.length > 0) {
        return gameState.candidates.map(c => c.place).filter(Boolean);
    }
    return Array.isArray(gameState.places) ? gameState.places : [];
}

function refreshLocationFinder() {
    const countySelect = document.getElementById('finderCounty');
    const citySelect = document.getElementById('finderCity');
    const placeInput = document.getElementById('finderPlaceInput');
    const placeOptions = document.getElementById('finderPlaceOptions');
    const countElem = document.getElementById('finderCount');
    if (!countySelect || !citySelect || !placeInput || !placeOptions || !countElem) return;

    const viablePlaces = getViablePlacesForFinder();
    const prevCounty = countySelect.value;
    const prevCity = citySelect.value;
    const prevPlaceText = (placeInput.value || '').trim();

    const countyValues = [...new Set(viablePlaces.map(p => p.county).filter(Boolean))].sort();
    countySelect.innerHTML = '<option value="">Select county</option>';
    countyValues.forEach(county => {
        const opt = document.createElement('option');
        opt.value = county;
        opt.textContent = county;
        countySelect.appendChild(opt);
    });
    countySelect.value = countyValues.includes(prevCounty) ? prevCounty : '';

    const countySelected = Boolean(countySelect.value);
    citySelect.disabled = !countySelected;
    placeInput.disabled = !countySelected;

    if (!countySelected) {
        citySelect.innerHTML = '<option value="">Select county first</option>';
        placeInput.value = '';
        placeInput.placeholder = 'Select county first';
        placeOptions.innerHTML = '';
        locationFinderState.visiblePlaces = [];
        updateFinderCountyOutline('');
        clearFinderSearchState();
        updateFinderNavigationUI();
        countElem.textContent = 'Select a county to load viable places';
        return;
    }

    updateFinderCountyOutline(countySelect.value);

    const placesByCounty = countySelect.value
        ? viablePlaces.filter(p => p.county === countySelect.value)
        : viablePlaces;

    const cityValues = [...new Set(placesByCounty.map(p => p.city).filter(Boolean))].sort();
    citySelect.innerHTML = '<option value="">All cities</option>';
    cityValues.forEach(city => {
        const opt = document.createElement('option');
        opt.value = city;
        opt.textContent = city;
        citySelect.appendChild(opt);
    });
    citySelect.value = cityValues.includes(prevCity) ? prevCity : '';

    const narrowedPlaces = placesByCounty.filter(p => !citySelect.value || p.city === citySelect.value);
    locationFinderState.visiblePlaces = narrowedPlaces;

    placeInput.placeholder = citySelect.value ? `Type a place name in ${citySelect.value}` : `Type a place name in ${countySelect.value} County`;
    placeOptions.innerHTML = '';
    const optionSet = new Set();
    narrowedPlaces
        .slice()
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
        .slice(0, 500)
        .forEach(place => {
            const optionLabel = String(place.name || '').trim();
            if (!optionLabel) return;
            if (optionSet.has(optionLabel)) return;
            optionSet.add(optionLabel);
            const opt = document.createElement('option');
            opt.value = optionLabel;
            placeOptions.appendChild(opt);
        });

    const stillValidText = prevPlaceText && narrowedPlaces.some(p => {
        return String(p.name || '').trim().toLowerCase() === prevPlaceText.toLowerCase();
    });
    placeInput.value = stillValidText ? prevPlaceText : '';

    clearFinderSearchState();
    updateFinderNavigationUI();

    countElem.textContent = `${narrowedPlaces.length} viable location${narrowedPlaces.length === 1 ? '' : 's'} in current filter`;
}

function focusFinderPlace(place) {
    if (!place || !Array.isArray(place.coordinates) || place.coordinates.length < 2 || !gameState.map) return;
    const [lng, lat] = place.coordinates;

    if (gameState.finderMarker) {
        gameState.map.removeLayer(gameState.finderMarker);
        gameState.finderMarker = null;
    }

    gameState.finderMarker = L.circleMarker([lat, lng], {
        radius: 8,
        color: '#0071CE',
        fillColor: '#00AEEF',
        fillOpacity: 0.9,
        weight: 2
    }).addTo(gameState.map);

    const city = place.city ? `<br>City: ${place.city}` : '';
    const county = place.county ? `<br>County: ${place.county}` : '';
    gameState.finderMarker.bindPopup(`<strong>${place.name}</strong>${city}${county}`).openPopup();

    gameState.map.setView([lat, lng], 17, { animate: true, duration: 0.5 });
}

function focusFinderFilteredArea() {
    if (!gameState.map || !locationFinderState.visiblePlaces.length) return;
    const points = locationFinderState.visiblePlaces
        .filter(p => Array.isArray(p.coordinates) && p.coordinates.length >= 2)
        .map(p => [p.coordinates[1], p.coordinates[0]]);

    if (points.length === 0) return;
    if (points.length === 1) {
        gameState.map.setView(points[0], 12, { animate: true, duration: 0.5 });
        return;
    }

    const bounds = L.latLngBounds(points);
    gameState.map.fitBounds(bounds.pad(0.12), { animate: true, duration: 0.5 });
}

function handleLocationFinderSearch() {
    const placeInput = document.getElementById('finderPlaceInput');
    const countElem = document.getElementById('finderCount');
    if (!placeInput) return;

    const term = (placeInput.value || '').trim().toLowerCase();
    if (term) {
        const byName = locationFinderState.visiblePlaces.filter(p => String(p.name || '').trim().toLowerCase() === term);
        if (byName.length === 1) {
            focusFinderPlace(byName[0]);
            locationFinderState.searchMatches = [byName[0]];
            locationFinderState.currentMatchIndex = 0;
            locationFinderState.searchTerm = term;
            updateFinderNavigationUI();
            if (countElem) countElem.textContent = 'Showing exact location match';
            return;
        }

        const byPrefix = locationFinderState.visiblePlaces.filter(p => String(p.name || '').trim().toLowerCase().startsWith(term));
        if (byPrefix.length === 1) {
            focusFinderPlace(byPrefix[0]);
            locationFinderState.searchMatches = [byPrefix[0]];
            locationFinderState.currentMatchIndex = 0;
            locationFinderState.searchTerm = term;
            updateFinderNavigationUI();
            if (countElem) countElem.textContent = 'Showing closest location match';
            return;
        }

        const byContains = locationFinderState.visiblePlaces.filter(p => String(p.name || '').trim().toLowerCase().includes(term));
        if (byContains.length === 1) {
            focusFinderPlace(byContains[0]);
            locationFinderState.searchMatches = [byContains[0]];
            locationFinderState.currentMatchIndex = 0;
            locationFinderState.searchTerm = term;
            updateFinderNavigationUI();
            if (countElem) countElem.textContent = 'Showing exact location match';
            return;
        }

        const subset = byName.length ? byName : (byPrefix.length ? byPrefix : byContains);
        if (subset.length > 1) {
            const sortedMatches = subset
                .slice()
                .sort((a, b) => {
                    const nameComp = String(a.name || '').localeCompare(String(b.name || ''));
                    if (nameComp !== 0) return nameComp;
                    const cityComp = String(a.city || '').localeCompare(String(b.city || ''));
                    if (cityComp !== 0) return cityComp;
                    return String(a.county || '').localeCompare(String(b.county || ''));
                });

            locationFinderState.searchMatches = sortedMatches;
            locationFinderState.currentMatchIndex = 0;
            locationFinderState.searchTerm = term;
            focusFinderMatchAtIndex(0);

            if (countElem) {
                countElem.textContent = `${sortedMatches.length} matches found. Use ◀ ▶ to cycle.`;
            }
            return;
        }
    }

    clearFinderSearchState();
    updateFinderNavigationUI();
    focusFinderFilteredArea();
}

function resetLocationFinder() {
    const countySelect = document.getElementById('finderCounty');
    const citySelect = document.getElementById('finderCity');
    const placeInput = document.getElementById('finderPlaceInput');
    if (countySelect) countySelect.value = '';
    if (citySelect) citySelect.value = '';
    if (placeInput) placeInput.value = '';
    clearFinderSearchState();
    updateFinderNavigationUI();
    refreshLocationFinder();

    if (gameState.map) {
        gameState.map.setView([32.6, -83.4], 8, { animate: true, duration: 0.5 });
    }
}

function getCityBoundaryKey(cityName) {
    return cityName ? cityName.toLowerCase().trim() : null;
}

function getFeatureProperties(feature) {
    return feature?.properties || feature || {};
}

function getFeatureName(feature) {
    const props = getFeatureProperties(feature);
    return props.NAME || props.name || props.city || props.city_ascii || null;
}

function getCountyNameFromCityRecord(city) {
    const props = getFeatureProperties(city);
    return props.county_name || props.county || props.COUNTY || props.COUNTYNAME || null;
}

function isPointGeometry(geometry) {
    return geometry && geometry.type === 'Point' && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2;
}

function pointWithinBBox(coordinates, bbox) {
    if (!Array.isArray(coordinates) || coordinates.length < 2 || !Array.isArray(bbox) || bbox.length < 4) return false;
    const [lng, lat] = coordinates;
    return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

function buildBoundaryLookup(features = []) {
    const canComputeBBox = Boolean(window.turf && typeof window.turf.bbox === 'function');
    return features
        .filter(feature => feature && feature.geometry)
        .map(feature => ({
            feature,
            bbox: canComputeBBox ? window.turf.bbox(feature) : null,
            name: getFeatureName(feature)
        }));
}

function findContainingFeature(coordinates, boundaryLookup = []) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
    if (!window.turf || typeof window.turf.point !== 'function' || typeof window.turf.booleanPointInPolygon !== 'function') {
        return null;
    }

    const point = window.turf.point(coordinates);

    for (const entry of boundaryLookup) {
        if (!entry?.feature) continue;
        if (entry.bbox && !pointWithinBBox(coordinates, entry.bbox)) continue;

        try {
            if (window.turf.booleanPointInPolygon(point, entry.feature)) {
                return entry.feature;
            }
        } catch (error) {
            console.warn('⚠️ Could not test point against boundary:', error);
        }
    }

    return null;
}

function resolveCountyFromCoordinates(coordinates, countyLookup = []) {
    const countyFeature = findContainingFeature(coordinates, countyLookup);
    return countyFeature ? getFeatureName(countyFeature) : null;
}

function buildCityCentersByCounty(cities = []) {
    const citiesByCounty = new Map();
    const allCities = [];
    const citiesByName = new Map();

    cities.forEach(city => {
        const props = getFeatureProperties(city);
        const cityName = getFeatureName(city);
        const countyName = getCountyNameFromCityRecord(city);
        const lat = Number(props.lat);
        const lng = Number(props.lng);
        const population = Number(props.population) || 0;

        if (!cityName || !countyName || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const countyKey = normalizeCountyName(countyName);
        const cityEntry = {
            name: cityName,
            county: countyName,
            coordinates: [lng, lat],
            population
        };

        if (!citiesByCounty.has(countyKey)) {
            citiesByCounty.set(countyKey, []);
        }

        citiesByCounty.get(countyKey).push(cityEntry);

        const cityKey = getCityBoundaryKey(cityName);
        if (!citiesByName.has(cityKey)) {
            citiesByName.set(cityKey, []);
        }
        citiesByName.get(cityKey).push(cityEntry);
        allCities.push(cityEntry);
    });

    citiesByCounty.set('__all__', allCities);
    citiesByCounty.set('__byName__', citiesByName);

    return citiesByCounty;
}

function selectNearestCityCandidate(originPoint, cityCandidates = [], countyKey = '') {
    if (!Array.isArray(cityCandidates) || cityCandidates.length === 0) return null;

    let best = null;

    cityCandidates.forEach(city => {
        if (!Array.isArray(city.coordinates) || city.coordinates.length < 2) return;
        const cityPoint = window.turf.point(city.coordinates);
        const distanceMiles = window.turf.distance(originPoint, cityPoint, { units: 'miles' });
        const sameCounty = !countyKey || normalizeCountyName(city.county) === countyKey;
        const countyPenalty = sameCounty ? 0 : 1.5;
        const populationBonus = city.population > 0 ? Math.min(1.2, Math.log10(city.population + 1) / 5) : 0;
        const score = distanceMiles + countyPenalty - (populationBonus * 0.35);

        if (
            !best ||
            score < best.score ||
            (Math.abs(score - best.score) < 0.05 && distanceMiles < best.distanceMiles) ||
            (Math.abs(distanceMiles - best.distanceMiles) < 0.05 && (city.population || 0) > (best.population || 0))
        ) {
            best = {
                name: city.name,
                county: city.county,
                population: city.population || 0,
                distanceMiles,
                score
            };
        }
    });

    return best;
}

function resolveCityFromCoordinates(coordinates, cityBoundaryLookup = [], cityCentersByCounty = new Map(), countyName = null) {
    if (!window.turf || typeof window.turf.point !== 'function' || typeof window.turf.distance !== 'function') {
        return null;
    }

    const cityFeature = findContainingFeature(coordinates, cityBoundaryLookup);
    const boundaryCityName = cityFeature ? getFeatureName(cityFeature) : null;
    const countyKey = normalizeCountyName(countyName);
    const originPoint = window.turf.point(coordinates);

    let allCityCandidates = cityCentersByCounty.get('__all__');
    if (!Array.isArray(allCityCandidates)) {
        allCityCandidates = [];
        cityCentersByCounty.forEach((cities, key) => {
            if (key !== '__all__' && key !== '__byName__' && Array.isArray(cities)) {
                allCityCandidates.push(...cities);
            }
        });
    }

    const nearestCity = selectNearestCityCandidate(originPoint, allCityCandidates, countyKey);

    if (boundaryCityName) {
        const byName = cityCentersByCounty.get('__byName__');
        const boundaryCityCandidates = byName && typeof byName.get === 'function'
            ? byName.get(getCityBoundaryKey(boundaryCityName)) || []
            : [];
        const nearestBoundaryCity = selectNearestCityCandidate(originPoint, boundaryCityCandidates, countyKey);

        if (!nearestBoundaryCity) {
            return nearestCity && nearestCity.distanceMiles <= CITY_FALLBACK_MAX_DISTANCE_MILES
                ? nearestCity.name
                : boundaryCityName;
        }

        if (
            nearestCity &&
            nearestBoundaryCity &&
            nearestBoundaryCity.distanceMiles - nearestCity.distanceMiles > CITY_BOUNDARY_OVERRIDE_MILES
        ) {
            return nearestCity.name;
        }

        return boundaryCityName;
    }

    return nearestCity && nearestCity.distanceMiles <= CITY_FALLBACK_MAX_DISTANCE_MILES
        ? nearestCity.name
        : null;
}

function yieldToMainThread() {
    return new Promise(resolve => requestAnimationFrame(resolve));
}

async function extractPlacesFromGeoJsonSources(
    sources = [],
    countyLookup = [],
    cityBoundaryLookup = [],
    cityCentersByCounty = new Map(),
    options = {}
) {
    const places = [];
    const featureChunkSize = PLACE_EXTRACTION_CHUNK_SIZE;
    const onChunk = typeof options.onChunk === 'function' ? options.onChunk : null;
    let chunkBuffer = [];

    const flushChunk = async () => {
        if (!onChunk || chunkBuffer.length === 0) return;
        const toEmit = chunkBuffer;
        chunkBuffer = [];
        onChunk(toEmit);
        await yieldToMainThread();
    };

    for (const source of sources) {
        const features = source?.features || [];

        for (let i = 0; i < features.length; i++) {
            const feature = features[i];
            if (!feature || !isPointGeometry(feature.geometry)) continue;

            const props = getFeatureProperties(feature);
            const name = props.name || props.NAME || null;
            const fclass = props.fclass || null;
            const coordinates = feature.geometry.coordinates;

            if (!name || !fclass || EXCLUDED_PLACE_TYPES.includes(fclass)) continue;

            const county = resolveCountyFromCoordinates(coordinates, countyLookup);
            const city = resolveCityFromCoordinates(coordinates, cityBoundaryLookup, cityCentersByCounty, county);

            places.push({
                name,
                fclass,
                city,
                county,
                coordinates
            });

            if (onChunk) {
                chunkBuffer.push(places[places.length - 1]);
            }

            if ((i + 1) % featureChunkSize === 0) {
                await flushChunk();
                await yieldToMainThread();
            }
        }

        await flushChunk();
        await yieldToMainThread();
    }

    await flushChunk();

    return places;
}

function renderInitialPlacesChunk(chunkPlaces = []) {
    if (!gameState.markers || !Array.isArray(chunkPlaces) || chunkPlaces.length === 0) return;

    const renderToken = gameState.mapRenderToken;
    const showTooltips = gameState.places.length <= MAX_INITIAL_MARKER_TOOLTIPS;
    const markerRenderTasks = [];

    const { orderedItems: orderedChunk, categoryRank } = orderByCategoryFrequency(
        chunkPlaces,
        place => place.fclass,
        { topFirst: PROGRESSIVE_TOP_FIRST_RENDER }
    );

    orderedChunk.forEach(place => {
        if (!place || !Array.isArray(place.coordinates) || place.coordinates.length < 2) return;
        if (place.fclass === 'personal_residence' || place.fclass === 'personal_workplace') return;

        const [lng, lat] = place.coordinates;
        const color = getPlaceColor(place.fclass);

        markerRenderTasks.push(() => {
            const marker = L.circleMarker([lat, lng], {
                radius: 4,
                fillColor: color,
                color: color,
                weight: 0,
                opacity: 0.7,
                fillOpacity: 0.7,
                renderer: gameState.pointRenderer
            }).addTo(gameState.markers);

            if (PROGRESSIVE_TOP_FIRST_RENDER) {
                const rank = categoryRank.get(place.fclass || 'unknown') || 0;
                if (rank > 0) marker.bringToBack();
            }

            if (showTooltips) {
                marker.bindTooltip(`
                    <strong>${place.name}</strong><br>
                    Type: ${formatFclass(place.fclass)}<br>
                    ${place.city ? `City: ${place.city}<br>` : ''}
                    ${place.county ? `County: ${place.county}` : ''}
                `, {
                    direction: 'top',
                    offset: [0, -5]
                });
            }
        });
    });

    runMarkerRenderTasks(markerRenderTasks, renderToken);
}

function buildPlacesByCityIndex(places = []) {
    const placesByCity = new Map();

    places.forEach(place => {
        const cityKey = getCityBoundaryKey(place.city);
        if (!cityKey) return;
        if (!placesByCity.has(cityKey)) {
            placesByCity.set(cityKey, []);
        }
        placesByCity.get(cityKey).push(place);
    });

    return placesByCity;
}

function bufferFeature(feature, miles, cityName = 'Unknown city') {
    if (!feature || !feature.geometry) return null;

    if (!window.turf || typeof window.turf.buffer !== 'function') {
        return feature;
    }

    try {
        return window.turf.buffer(feature, miles, { units: 'miles' });
    } catch (error) {
        console.warn(`⚠️ Could not buffer feature for ${cityName}:`, error);
        return feature;
    }
}

function mergeBoundaryFeatures(baseFeature, extraFeature, cityName = 'Unknown city') {
    if (!baseFeature) return extraFeature || null;
    if (!extraFeature) return baseFeature;

    if (!window.turf || typeof window.turf.union !== 'function' || typeof window.turf.featureCollection !== 'function') {
        return baseFeature;
    }

    try {
        const merged = window.turf.union(window.turf.featureCollection([baseFeature, extraFeature]));
        return merged || baseFeature;
    } catch (error) {
        console.warn(`⚠️ Could not merge boundary pieces for ${cityName}:`, error);
        return baseFeature;
    }
}

function expandCityBoundary(feature, cityName = 'Unknown city') {
    if (!feature || !feature.geometry) return feature;

    if (!window.turf || typeof window.turf.buffer !== 'function') {
        console.warn(`⚠️ Turf buffer unavailable for ${cityName}, using original boundary`);
        return feature;
    }

    try {
        const buffered = window.turf.buffer(feature, CITY_OUTLINE_BUFFER_MILES, { units: 'miles' });
        if (!buffered || !buffered.geometry) {
            console.warn(`⚠️ Buffer failed for ${cityName}, using original boundary`);
            return feature;
        }

        buffered.properties = {
            ...(feature.properties || {}),
            ...(buffered.properties || {}),
            bufferMiles: CITY_OUTLINE_BUFFER_MILES,
            originalName: cityName
        };
        return buffered;
    } catch (error) {
        console.warn(`⚠️ Could not expand ${cityName} boundary:`, error);
        return feature;
    }
}

function buildExpandedCityBoundary(cityName, baseFeature, cityPlaces = []) {
    let boundary = baseFeature ? expandCityBoundary(baseFeature, cityName) : null;

    if (!window.turf) {
        return boundary || baseFeature;
    }

    const pointFeatures = cityPlaces
        .filter(place => Array.isArray(place.coordinates) && place.coordinates.length >= 2)
        .map(place => window.turf.point(place.coordinates, { name: place.name }));

    if (!boundary && pointFeatures.length > 0) {
        pointFeatures.forEach(pointFeature => {
            const pointCatchment = bufferFeature(pointFeature, CITY_OUTLINE_BUFFER_MILES, cityName);
            boundary = mergeBoundaryFeatures(boundary, pointCatchment, cityName);
        });
    }

    pointFeatures.forEach(pointFeature => {
        let pointInsideBoundary = false;

        if (boundary && typeof window.turf.booleanPointInPolygon === 'function') {
            try {
                pointInsideBoundary = window.turf.booleanPointInPolygon(pointFeature, boundary);
            } catch (error) {
                console.warn(`⚠️ Could not test point against ${cityName} boundary:`, error);
            }
        }

        if (!pointInsideBoundary) {
            const pointCatchment = bufferFeature(pointFeature, CITY_OUTLINE_BUFFER_MILES, cityName);
            boundary = mergeBoundaryFeatures(boundary, pointCatchment, cityName);
        }
    });

    if (boundary) {
        boundary.properties = {
            ...(baseFeature?.properties || {}),
            ...(boundary.properties || {}),
            bufferMiles: CITY_OUTLINE_BUFFER_MILES,
            originalName: cityName
        };
    }

    return boundary || baseFeature;
}

async function ensureCityBoundarySourceLoaded() {
    return;
}

async function ensureCityBoundariesForKeys(cityKeys = []) {
    const pendingKeys = cityKeys.filter(key => key && !gameState.cityBoundaries.has(key));
    if (pendingKeys.length === 0) return;

    await ensureCityBoundarySourceLoaded();

    pendingKeys.forEach(cityKey => {
        const cityPlaces = gameState.placesByCity.get(cityKey) || [];
        const baseFeature = null;
        const cityName = cityPlaces[0]?.city || cityKey;
        const expandedFeature = buildExpandedCityBoundary(cityName, baseFeature, cityPlaces);

        if (expandedFeature) {
            gameState.cityBoundaries.set(cityKey, expandedFeature);
        }
    });

    if (pendingKeys.length > 0) {
        console.log(`🗺️ Prepared ${pendingKeys.length} city outline${pendingKeys.length === 1 ? '' : 's'} on demand`);
    }
}

async function ensureCityBoundariesForCurrentCounty() {
    const activeCounties = new Set(gameState.candidates.map(c => c.place.county).filter(Boolean));
    if (activeCounties.size !== 1) return;

    const cityKeys = Array.from(new Set(
        gameState.candidates
            .map(c => getCityBoundaryKey(c.place.city))
            .filter(Boolean)
    ));

    if (cityKeys.length === 0) return;
    await ensureCityBoundariesForKeys(cityKeys);
}

// ============================================
// DATA LOADING
// ============================================

// Generate personal locations (residences and workplaces)
function generatePersonalLocations() {
    const relationships = [
        { type: 'mine', label: 'Your' },
        { type: 'family', label: 'A family member\'s' },
        { type: 'friend', label: 'A friend\'s' },
        { type: 'relative', label: 'A relative\'s' },
        { type: 'coworker', label: 'A coworker\'s' },
        { type: 'coach', label: 'Your coach\'s' },
        { type: 'teacher', label: 'Your teacher\'s' },
        { type: 'boss', label: 'Your boss\'s' },
        { type: 'celebrity', label: 'A celebrity\'s' },
        { type: 'neighbor', label: 'A neighbor\'s' }
    ];
    
    const locationTypes = [
        { type: 'residence', label: 'house', fclass: 'personal_residence' },
        { type: 'workplace', label: 'workplace', fclass: 'personal_workplace' }
    ];
    
    const personalPlaces = [];
    
    // Create county-level personal locations (broadest areas)
    if (gameState.counties.features) {
        gameState.counties.features.forEach((county, index) => {
            const countyName = county.properties?.NAME || county.properties?.name;
            
            if (!countyName || !county.geometry) {
                if (index < 2) console.log(`⚠️ Skipping county ${index} - missing name or geometry`);
                return;
            }
            
            // Calculate center point for the county
            const bounds = L.geoJSON(county).getBounds();
            const center = bounds.getCenter();
            const coordinates = [center.lng, center.lat];
            
            // Create personal locations for each county
            relationships.forEach(rel => {
                locationTypes.forEach(locType => {
                    personalPlaces.push({
                        name: `${rel.label} ${locType.label} in ${countyName} County`,
                        fclass: locType.fclass,
                        city: null,  // County-level, no specific city
                        county: countyName,
                        coordinates: coordinates,  // Center point for candidate tracking
                        geometry: county.geometry,  // Store geometry for map rendering
                        locationType: locType.type,
                        relationship: rel.type,
                        areaType: 'county'  // Flag for area rendering
                    });
                });
            });
        });
    }
    
    // Create city-level personal locations (more specific)
    gameState.cities.forEach((city, index) => {
        const cityName = city.city || city.city_ascii || 
                        city.properties?.NAME || city.properties?.name || 
                        city.NAME || city.name;
        const countyName = city.county_name || city.county || 
                          city.properties?.COUNTY || city.properties?.county || 
                          city.COUNTY;
        
        let coordinates;
        if (city.lat !== undefined && city.lng !== undefined) {
            coordinates = [city.lng, city.lat];
        } else if (city.geometry) {
            if (city.geometry.type === 'Point') {
                coordinates = city.geometry.coordinates;
            } else if (city.geometry.coordinates && city.geometry.coordinates[0]) {
                const coords = city.geometry.coordinates[0];
                coordinates = Array.isArray(coords[0]) ? coords[0] : coords;
            }
        } else if (city.coordinates) {
            coordinates = city.coordinates;
        } else if (city.geometry_center) {
            coordinates = city.geometry_center;
        }
        
        if (!cityName || !coordinates) {
            return;
        }
        
        // Create city-level personal locations using center point
        relationships.forEach(rel => {
            locationTypes.forEach(locType => {
                personalPlaces.push({
                    name: `${rel.label} ${locType.label} in ${cityName}`,
                    fclass: locType.fclass,
                    city: cityName,
                    county: countyName,
                    coordinates: coordinates,  // Center point of city
                    geometry: city.geometry || (gameState.cityBoundaries?.get(cityName?.toLowerCase()?.trim())?.geometry) || null,
                    locationType: locType.type,
                    relationship: rel.type,
                    areaType: 'city'  // Will be rendered as city boundary polygon
                });
            });
        });
    });
    
    // Add personal places to the main places array
    gameState.places = gameState.places.concat(personalPlaces);
}

// Load all required data files
async function loadData() {
    try {
        const responses = await Promise.all([
            ...MAIN_PLACE_SOURCE_FILES.map(path => fetch(path)),
            fetch('data/ga_cities.json'),
            fetch('data/ga_counties.geojson')
        ]);

        responses.forEach((response, index) => {
            if (!response.ok) {
                const label = index < MAIN_PLACE_SOURCE_FILES.length
                    ? MAIN_PLACE_SOURCE_FILES[index]
                    : ['data/ga_cities.json', 'data/ga_counties.geojson'][index - MAIN_PLACE_SOURCE_FILES.length];
                throw new Error(`Failed to load ${label}: ${response.status}`);
            }
        });

        // Parse city/county metadata first (smaller files), so we can begin streaming places ASAP.
        const citiesData = await responses[MAIN_PLACE_SOURCE_FILES.length].json();
        await yieldToMainThread();
        const countiesData = await responses[MAIN_PLACE_SOURCE_FILES.length + 1].json();
        await yieldToMainThread();

        gameState.cities = citiesData.features || citiesData;
        gameState.counties = countiesData;
        
        gameState.cityBoundaries = new Map();
        gameState.mapRenderToken += 1;
        gameState.markers.clearLayers();
        gameState.polygons.clearLayers();
        gameState.places = [];

        const countyLookup = buildBoundaryLookup(gameState.counties.features || []);
        const cityCentersByCounty = buildCityCentersByCounty(gameState.cities);

        // Parse and extract each large place source incrementally so points appear during loading.
        for (let sourceIndex = 0; sourceIndex < MAIN_PLACE_SOURCE_FILES.length; sourceIndex++) {
            const sourceData = await responses[sourceIndex].json();
            await yieldToMainThread();

            await extractPlacesFromGeoJsonSources(
                [sourceData],
                countyLookup,
                [],
                cityCentersByCounty,
                {
                    onChunk: (chunkPlaces) => {
                        if (!Array.isArray(chunkPlaces) || chunkPlaces.length === 0) return;
                        gameState.places.push(...chunkPlaces);
                        renderInitialPlacesChunk(chunkPlaces);
                    }
                }
            );

            await yieldToMainThread();
        }

        gameState.placesByCity = buildPlacesByCityIndex(gameState.places);
        
        // Calculate geographic metadata for each county
        if (gameState.counties.features) {
            gameState.counties.features.forEach(county => {
                const bounds = L.geoJSON(county).getBounds();
                const center = bounds.getCenter();
                county.centerLat = center.lat;
                county.centerLng = center.lng;
            });
            
            // Calculate median lat/lng to determine regions
            const lats = gameState.counties.features.map(c => c.centerLat).sort((a, b) => a - b);
            const lngs = gameState.counties.features.map(c => c.centerLng).sort((a, b) => a - b);
            const medianLat = lats[Math.floor(lats.length / 2)];
            const medianLng = lngs[Math.floor(lngs.length / 2)];
            
            // Assign regions to each county
            gameState.counties.features.forEach(county => {
                county.region_ns = county.centerLat > medianLat ? 'north' : 'south';
                county.region_ew = county.centerLng > medianLng ? 'east' : 'west';
                county.region = `${county.region_ns}_${county.region_ew}`; // e.g., "north_west"
            });
            

        }

        // Generate personal locations (houses, workplaces, etc.)
        generatePersonalLocations();
        gameState.placesByCity = buildPlacesByCityIndex(gameState.places);

        return true;
    } catch (error) {
        console.error('[Data] Load failed:', error.message);
        
        // Show helpful error message to user
        const errorMsg = `Error loading data files: ${error.message}\n\n` +
            `If you're opening this file locally (file:// URL), you need to:\n` +
            `1. Run a local web server (e.g., 'python -m http.server' or 'npx serve')\n` +
            `2. Or upload to GitHub Pages\n\n` +
            `Current URL: ${window.location.href}\n\n` +
            `Check the browser console (F12) for more details.`;
        
        alert(errorMsg);
        
        // Display error in the UI
        document.getElementById('startScreen').innerHTML = `
            <h2 style="color: #CC0000;">⚠️ Data Loading Error</h2>
            <div style="text-align: left; max-width: 600px; background: #fff3cd; padding: 20px; border-radius: 8px; border: 2px solid #ffc107;">
                <p><strong>Could not load data files.</strong></p>
                <p><strong>Error:</strong> ${error.message}</p>
                <hr style="margin: 15px 0;">
                <p><strong>If opening locally (file:// URL):</strong></p>
                <ol>
                    <li>Open Terminal/Command Prompt</li>
                    <li>Navigate to the Geonator folder: <code>cd /Users/linnerlek/Documents/Geonator</code></li>
                    <li>Run: <code>python3 -m http.server 8000</code></li>
                    <li>Open: <a href="http://localhost:8000" target="_blank">http://localhost:8000</a></li>
                </ol>
                <hr style="margin: 15px 0;">
                <p><strong>For GitHub Pages:</strong></p>
                <ol>
                    <li>Ensure all files are committed to your repository</li>
                    <li>Enable GitHub Pages in repository settings</li>
                    <li>Access via your GitHub Pages URL</li>
                </ol>
                <hr style="margin: 15px 0;">
                <p><strong>Current URL:</strong> <code>${window.location.href}</code></p>
                <p><strong>Tip:</strong> Open browser console (F12) to see detailed error logs.</p>
            </div>
        `;
        
        return false;
    }
}

// ============================================
// MAP SETUP
// ============================================

function getPlaceColor(fclass) {
    const type = String(fclass || '').toLowerCase();

    // Food & Dining - Red
    const food = ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'bakery', 'butcher', 'food_court', 
                  'biergarten', 'nightclub'];
    if (food.includes(type)) return '#CC0000';
    
    // Shopping & Services - Purple
    const shopping = ['supermarket', 'mall', 'convenience', 'department_store', 'kiosk', 'market_place',
                     'bookshop', 'clothes', 'gift_shop', 'jeweller', 'toy_shop', 'mobile_phone_shop',
                     'computer_shop', 'bicycle_shop', 'car_dealership', 'furniture_shop', 'florist',
                     'garden_centre', 'hairdresser', 'beauty_shop', 'chemist', 'optician', 'stationery',
                     'video_shop', 'newsagent', 'greengrocer', 'shoe_shop', 'sports_shop', 'laundry',
                     'bank', 'travel_agent', 'travelagency', 'general', 'beverages', 'doityourself', 'outdoor_shop'];
    if (shopping.includes(type)) return '#9B59B6';
    
    // Education - Dark Blue
    const education = ['school', 'college', 'university', 'kindergarten', 'library'];
    if (education.includes(type)) return '#0039A6';
    
    // Healthcare - Green
    const healthcare = ['hospital', 'clinic', 'doctors', 'dentist', 'pharmacy', 'veterinary', 'nursing_home'];
    if (healthcare.includes(type)) return '#27AE60';
    
    // Tourism & Attractions - Vibrant Blue
    const tourism = ['museum', 'castle', 'monument', 'memorial', 'attraction', 'viewpoint', 'artwork',
                    'arts_centre', 'theatre', 'cinema', 'theme_park', 'zoo', 'ruins', 'fort', 
                    'archaeological', 'battlefield', 'lighthouse', 'observation_tower', 'tower', 'fountain'];
    if (tourism.includes(type)) return '#00AEEF';
    
    // Accommodation - Teal
    const accommodation = ['hotel', 'motel', 'hostel', 'guesthouse', 'camp_site', 'caravan_site', 'chalet', 'alpine_hut'];
    if (accommodation.includes(type)) return '#16A085';
    
    // Recreation & Sports - Orange
    const recreation = ['park', 'playground', 'sports_centre', 'stadium', 'swimming_pool', 'pitch',
                       'golf_course', 'dog_park', 'picnic_site', 'track', 'ice_rink'];
    if (recreation.includes(type)) return '#E67E22';
    
    // Government/Public Services - Cool Blue
    const government = ['town_hall', 'courthouse', 'police', 'fire_station', 'post_office', 'post_box',
                       'embassy', 'public_building', 'prison', 'community_centre'];
    if (government.includes(type)) return '#0071CE';
    
    // Transportation - Yellow
    const transportation = [
        'car_rental', 'car_sharing', 'bicycle_rental', 'car_wash',
        'airfield', 'airport', 'apron', 'bus_station', 'bus_stop',
        'ferry_terminal', 'helipad', 'railway_halt', 'railway_station',
        'taxi', 'tram_stop', 'vending_parking'
    ];
    if (transportation.includes(type)) return '#F39C12';
    
    // Places (Cities/Towns) - Light Blue
    const places = ['city', 'town', 'village', 'suburb', 'locality', 'county', 'hamlet', 'island'];
    if (places.includes(type)) return '#97CAEB';
    
    // Utilities & Infrastructure - Cool Gray
    const utilities = ['water_tower', 'wastewater_plant', 'water_works', 'water_mill', 'water_well',
                      'recycling', 'recycling_clothes', 'recycling_glass', 'recycling_metal', 
                      'recycling_paper', 'waste_basket', 'toilet', 'drinking_water', 'telephone',
                      'comms_tower', 'atm', 'vending_machine', 'vending_any', 'windmill', 'farm'];
    if (utilities.includes(type)) return '#767679';
    
    // Religious & Memorial - Dark Purple
    const religious = [
        'graveyard', 'christian', 'christian_anglican', 'christian_catholic',
        'christian_evangelical', 'christian_lutheran', 'christian_methodist',
        'christian_orthodox', 'christian_protestant', 'muslim', 'muslim_shia',
        'muslim_sunni', 'jewish', 'hindu', 'buddhist', 'sikh',
        'wayside_cross', 'wayside_shrine'
    ];
    if (religious.includes(type) || type.startsWith('christian_') || type.startsWith('muslim_')) return '#8E44AD';
    
    // Outdoor Structures - Brown
    const outdoor = ['shelter', 'bench', 'hunting_stand'];
    if (outdoor.includes(type)) return '#795548';
    
    // Personal Locations
    if (type === 'personal_residence') return '#0039A6'; // GSU Blue
    if (type === 'personal_workplace') return '#0071CE';
    
    // Default - Cool Blue
    return '#0071CE';
}

function initializeMap() {
    // Initialize Leaflet map centered on Georgia - will be adjusted when places load
    gameState.map = L.map('map', { preferCanvas: true }).setView([32.6, -83.4], 8);
    gameState.pointRenderer = L.canvas({ padding: 0.2 });

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(gameState.map);

    // Initialize marker layer (for point locations)
    gameState.markers = L.layerGroup().addTo(gameState.map);
    
    // Initialize polygons layer (for area-based personal locations)
    gameState.polygons = L.layerGroup().addTo(gameState.map);
    
    // Create SVG pattern for hatched fill on personal locations
    // Wait for map to be ready, then add pattern
    setTimeout(() => {
        const overlayPane = gameState.map.getPanes().overlayPane;
        let svg = overlayPane.querySelector('svg');
        
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.pointerEvents = 'none';
            overlayPane.appendChild(svg);
        }
        
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'diagonalStripes');
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        pattern.setAttribute('width', '8');
        pattern.setAttribute('height', '8');
        pattern.setAttribute('patternTransform', 'rotate(45)');
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('y1', '0');
        line.setAttribute('x2', '0');
        line.setAttribute('y2', '8');
        line.setAttribute('stroke', '#E91E63');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('opacity', '0.4');
        
        pattern.appendChild(line);
        defs.appendChild(pattern);
        svg.insertBefore(defs, svg.firstChild);
    }, 100);
}

function runMarkerRenderTasks(tasks, renderToken, onComplete = null) {
    if (!Array.isArray(tasks) || tasks.length === 0) {
        if (typeof onComplete === 'function') onComplete();
        return;
    }

    let index = 0;
    const runChunk = () => {
        if (renderToken !== gameState.mapRenderToken) return;

        const end = Math.min(index + MARKER_RENDER_CHUNK_SIZE, tasks.length);
        for (; index < end; index++) {
            tasks[index]();
        }

        if (index < tasks.length) {
            requestAnimationFrame(runChunk);
            return;
        }

        if (typeof onComplete === 'function') onComplete();
    };

    requestAnimationFrame(runChunk);
}

function orderByCategoryFrequency(items = [], getCategory = () => '', options = {}) {
    const topFirst = options.topFirst === true;
    const counts = new Map();
    const buckets = new Map();

    items.forEach(item => {
        const category = getCategory(item) || 'unknown';
        counts.set(category, (counts.get(category) || 0) + 1);
        if (!buckets.has(category)) {
            buckets.set(category, []);
        }
        buckets.get(category).push(item);
    });

    const sortedEntries = Array.from(counts.entries()).sort((a, b) => {
        // Default: most frequent first (bottom-first drawing).
        // topFirst: least frequent first so visible "top" categories appear immediately.
        return topFirst ? (a[1] - b[1]) : (b[1] - a[1]);
    });

    const orderedCategories = sortedEntries.map(([category]) => category);
    const categoryRank = new Map();
    orderedCategories.forEach((category, index) => {
        categoryRank.set(category, index);
    });

    const orderedItems = [];
    orderedCategories.forEach(category => {
        const bucket = buckets.get(category);
        if (bucket && bucket.length) {
            orderedItems.push(...bucket);
        }
    });

    return {
        orderedItems,
        categoryRank
    };
}

function showAllPlacesOnMap() {
    gameState.mapRenderToken += 1;
    const renderToken = gameState.mapRenderToken;

    // Display all places on the map before game starts
    gameState.markers.clearLayers();
    gameState.polygons.clearLayers();
    
    if (!gameState.places || gameState.places.length === 0) return;
    

    
    const bounds = [];
    const baseRadius = 4;  // Small markers for many places
    
    // Render top categories first for responsiveness, while keeping final layering with bringToBack().
    // Within each category, preserve original source order.
    const { orderedItems: sortedPlaces, categoryRank: placeCategoryRank } = orderByCategoryFrequency(
        gameState.places,
        place => place.fclass,
        { topFirst: PROGRESSIVE_TOP_FIRST_RENDER }
    );

    const markerRenderTasks = [];
    const showMarkerTooltips = sortedPlaces.length <= MAX_INITIAL_MARKER_TOOLTIPS;
    
    sortedPlaces.forEach(place => {
        // Skip personal locations on initial map display
        if (place.fclass === 'personal_residence' || place.fclass === 'personal_workplace') {
            return;
        }
        
        // Check if this is an area-based personal location
        if (place.areaType === 'county' && place.geometry) {
            // Render county as shaded polygon
            const color = getPlaceColor(place.fclass);
            
            const polygon = L.geoJSON(place.geometry, {
                style: {
                    fillColor: color,
                    fillOpacity: 0.15,
                    color: color,
                    weight: 2,
                    opacity: 0.5
                }
            }).addTo(gameState.polygons);
            
            polygon.bindTooltip(`
                <strong>${place.name}</strong><br>
                Type: ${formatFclass(place.fclass)}<br>
                ${place.county ? `County: ${place.county}` : ''}
            `, {
                direction: 'center',
                permanent: false
            });
            
            // Add center to bounds
            const [lng, lat] = place.coordinates;
            bounds.push([lat, lng]);
        } else if (place.areaType === 'city') {
            // Render city using real boundary polygon from geojson
            const [lng, lat] = place.coordinates;
            const color = getPlaceColor(place.fclass);
            const cityName = place.city || place.name;
            const boundaryFeature = cityName ? gameState.cityBoundaries.get(getCityBoundaryKey(cityName)) : null;
            const geometry = place.geometry || (boundaryFeature ? boundaryFeature.geometry : null);
            
            if (geometry && geometry.type !== 'Point') {
                const polygon = L.geoJSON(geometry, {
                    style: {
                        fillColor: color,
                        fillOpacity: 0.15,
                        color: color,
                        weight: 2,
                        opacity: 0.5
                    }
                }).addTo(gameState.polygons);
                
                polygon.bindTooltip(`
                    <strong>${place.name}</strong><br>
                    Type: ${formatFclass(place.fclass)}<br>
                    ${place.city ? `City: ${place.city}` : ''}
                `, {
                    direction: 'center',
                    permanent: false
                });
            } else {
                // Last-resort fallback circle if no boundary available
                const circle = L.circle([lat, lng], {
                    radius: 5000,
                    fillColor: color,
                    fillOpacity: 0.15,
                    color: color,
                    weight: 2,
                    opacity: 0.5
                }).addTo(gameState.polygons);
                
                circle.bindTooltip(`
                    <strong>${place.name}</strong><br>
                    Type: ${formatFclass(place.fclass)}<br>
                    ${place.city ? `City: ${place.city}` : ''}
                `, {
                    direction: 'center',
                    permanent: false
                });
            }
            
            bounds.push([lat, lng]);
        } else {
            // Render as regular marker
            const [lng, lat] = place.coordinates;
            
            // Color based on place category
            const color = getPlaceColor(place.fclass);

            markerRenderTasks.push(() => {
                const marker = L.circleMarker([lat, lng], {
                    radius: baseRadius,
                    fillColor: color,
                    color: color,
                    weight: 0,
                    opacity: 0.7,
                    fillOpacity: 0.7,
                    renderer: gameState.pointRenderer
                }).addTo(gameState.markers);

                if (PROGRESSIVE_TOP_FIRST_RENDER) {
                    const rank = placeCategoryRank.get(place.fclass || 'unknown') || 0;
                    if (rank > 0) {
                        marker.bringToBack();
                    }
                }

                if (showMarkerTooltips) {
                    marker.bindTooltip(`
                        <strong>${place.name}</strong><br>
                        Type: ${formatFclass(place.fclass)}<br>
                        ${place.city ? `City: ${place.city}<br>` : ''}
                        ${place.county ? `County: ${place.county}` : ''}
                    `, {
                        direction: 'top',
                        offset: [0, -5]
                    });
                }
            });
            
            bounds.push([lat, lng]);
        }
    });

    runMarkerRenderTasks(markerRenderTasks, renderToken);
    
    // Set a good default view of Georgia instead of using fitBounds
    // fitBounds can zoom out too far when trying to fit all places
    gameState.map.setView([32.6, -83.4], 8, {
        animate: false
    });
    
    // Update legend while preserving overlay header/toggle controls
    updateMapLegend();
}

function highlightRegionCounties(regionType, regionValue) {
    // Clear any existing region highlights
    if (gameState.regionHighlights) {
        gameState.regionHighlights.clearLayers();
    }
    gameState.regionHighlights = L.layerGroup().addTo(gameState.map);
    
    if (!gameState.counties || !gameState.counties.features) return;
    
    
    // Get all counties in the specified region
    const regionCounties = gameState.counties.features.filter(county => {
        if (regionType === 'ns') {
            return county.region_ns === regionValue;
        } else if (regionType === 'ew') {
            return county.region_ew === regionValue;
        }
        return false;
    });
    
    
    // Highlight these counties with a distinct color
    regionCounties.forEach(county => {
        const countyName = county.properties?.NAME || county.properties?.name;
        
        L.geoJSON(county, {
            style: {
                fillColor: '#0039A6',  // Blue for the region being asked about
                fillOpacity: 0.28,
                color: '#FFFFFF',
                weight: 2.5,
                opacity: 0.9,
                dashArray: null // Solid line for selected region
            }
        }).addTo(gameState.regionHighlights).bindTooltip(countyName, {
            permanent: false,
            direction: 'center',
            className: 'region-highlight-tooltip'
        });
    });
    
    // Also show the other region in a different color for comparison
    const otherRegionValue = regionType === 'ns' 
        ? (regionValue === 'north' ? 'south' : 'north')
        : (regionValue === 'east' ? 'west' : 'east');
    
    const otherCounties = gameState.counties.features.filter(county => {
        if (regionType === 'ns') {
            return county.region_ns === otherRegionValue;
        } else if (regionType === 'ew') {
            return county.region_ew === otherRegionValue;
        }
        return false;
    });
    
    otherCounties.forEach(county => {
        const countyName = county.properties?.NAME || county.properties?.name;
        
        L.geoJSON(county, {
            style: {
                fillColor: '#767679',  // Gray for the opposite region
                fillOpacity: 0.22,
                color: '#FFFFFF',
                weight: 2,
                opacity: 0.75,
                dashArray: '8, 5' // Dashed line for comparison region
            }
        }).addTo(gameState.regionHighlights).bindTooltip(countyName, {
            permanent: false,
            direction: 'center',
            className: 'region-highlight-tooltip'
        });
    });
}

function clearRegionHighlights() {
    if (gameState.regionHighlights) {
        gameState.regionHighlights.clearLayers();
    }
}

function highlightSpecificCounty(countyName) {
    // Clear any existing region highlights
    if (gameState.regionHighlights) {
        gameState.regionHighlights.clearLayers();
    }
    gameState.regionHighlights = L.layerGroup().addTo(gameState.map);
    
    if (!gameState.counties || !gameState.counties.features) return;
    
    
    // Get all active counties
    const activeCounties = new Set(gameState.candidates.map(c => c.place.county).filter(Boolean));
    
    // Highlight the county being asked about prominently
    const askedCounty = gameState.counties.features.find(
        county => (county.properties?.NAME || county.properties?.name) === countyName
    );
    
    if (askedCounty) {
        L.geoJSON(askedCounty, {
            style: {
                fillColor: '#0039A6',  // Blue for the county being asked
                fillOpacity: 0.35,
                color: '#FFFFFF',
                weight: 3,
                opacity: 0.95,
                dashArray: null // Solid line for asked county
            }
        }).addTo(gameState.regionHighlights).bindTooltip(countyName, {
            permanent: true,
            direction: 'center',
            className: 'asked-county-tooltip'
        });
    }
    
    // Show other eligible counties in a lighter color
    const otherCounties = gameState.counties.features.filter(county => {
        const name = county.properties?.NAME || county.properties?.name;
        return activeCounties.has(name) && name !== countyName;
    });
    
    otherCounties.forEach(county => {
        const name = county.properties?.NAME || county.properties?.name;
        
        L.geoJSON(county, {
            style: {
                fillColor: '#767679',  // Gray for other eligible counties
                fillOpacity: 0.22,
                color: '#FFFFFF',
                weight: 2,
                opacity: 0.75,
                dashArray: '6, 4' // Dashed line to distinguish from asked county
            }
        }).addTo(gameState.regionHighlights).bindTooltip(name, {
            permanent: false,
            direction: 'center',
            className: 'eligible-county-tooltip'
        });
    });
}

function highlightCityBoundary(cityName) {
    if (!cityName) return;
    if (gameState.regionHighlights) {
        gameState.regionHighlights.clearLayers();
    }
    gameState.regionHighlights = L.layerGroup().addTo(gameState.map);

    const feature = gameState.cityBoundaries.get(getCityBoundaryKey(cityName));
    if (!feature) return;

    const layer = L.geoJSON(feature, {
        style: {
            fillColor: '#0039A6',
            fillOpacity: 0.18,
            color: '#0039A6',
            weight: 2.5,
            opacity: 0.85
        }
    }).addTo(gameState.regionHighlights);

    layer.bindTooltip(`<strong>${cityName}</strong>`, {
        permanent: false,
        direction: 'center',
        className: 'region-highlight-tooltip'
    });
}

function highlightCityRegion(question) {
    if (gameState.regionHighlights) {
        gameState.regionHighlights.clearLayers();
    }
    gameState.regionHighlights = L.layerGroup().addTo(gameState.map);

    const { county, axis, threshold, regionValue } = question;
    if (!county || typeof threshold !== 'number') return;

    const seenCities = new Set();
    const cityPoints = [];

    gameState.candidates.forEach(candidate => {
        const place = candidate.place;
        if (
            place.county === county &&
            place.city &&
            Array.isArray(place.coordinates) &&
            place.coordinates.length >= 2 &&
            !seenCities.has(place.city)
        ) {
            seenCities.add(place.city);
            const [lng, lat] = place.coordinates;
            cityPoints.push({ city: place.city, lat, lng });
        }
    });

    cityPoints.forEach(point => {
        const isBlueRegion = axis === 'ns'
            ? (regionValue === 'north' ? point.lat >= threshold : point.lat < threshold)
            : (regionValue === 'east' ? point.lng >= threshold : point.lng < threshold);

        const color = isBlueRegion ? '#0039A6' : '#767679';
        const fillOpacity = isBlueRegion ? 0.28 : 0.24;
        const weight = isBlueRegion ? 2.5 : 2;
        const dashArray = isBlueRegion ? null : '7, 4';

        const cityFeature = gameState.cityBoundaries.get(getCityBoundaryKey(point.city));
        if (cityFeature) {
            const layer = L.geoJSON(cityFeature, {
                style: {
                    fillColor: color,
                    fillOpacity: fillOpacity,
                    color: '#FFFFFF',
                    weight: weight,
                    opacity: 0.9,
                    dashArray: dashArray
                }
            }).addTo(gameState.regionHighlights);
            layer.bindTooltip(`${point.city}`, {
                permanent: false,
                direction: 'center',
                className: 'region-highlight-tooltip'
            });
        } else {
            // Fallback to circleMarker if no boundary available
            const marker = L.circleMarker([point.lat, point.lng], {
                radius: 9,
                fillColor: color,
                fillOpacity: fillOpacity,
                color: '#FFFFFF',
                weight: weight,
                opacity: 0.9,
                dashArray: dashArray
            }).addTo(gameState.regionHighlights);
            marker.bindTooltip(`${point.city}`, {
                permanent: false,
                direction: 'top',
                className: 'region-highlight-tooltip'
            });
        }
    });
}

function getLocationQuestionStyle(place, activeCityQuestion, activeCityRegionQuestion, activeGeoSplitQuestion) {
    if (activeCityQuestion) {
        const matchesCity = place.city === activeCityQuestion.value;
        return matchesCity
            ? {
                color: '#0039A6',
                fillOpacity: 0.30,
                opacity: 0.92,
                weight: 2.5,
                dashArray: null,
                markerWeight: 1.5,
                markerOpacity: 0.95,
                markerFillOpacity: 0.95
            }
            : {
                color: '#767679',
                fillOpacity: 0.20,
                opacity: 0.72,
                weight: 1.5,
                dashArray: '6, 4',
                markerWeight: 1,
                markerOpacity: 0.75,
                markerFillOpacity: 0.75
            };
    }

    if (
        activeCityRegionQuestion &&
        place.county === activeCityRegionQuestion.county &&
        Array.isArray(place.coordinates) &&
        place.coordinates.length >= 2
    ) {
        const [lng, lat] = place.coordinates;
        const isBlueRegion = activeCityRegionQuestion.axis === 'ns'
            ? (activeCityRegionQuestion.regionValue === 'north' ? lat >= activeCityRegionQuestion.threshold : lat < activeCityRegionQuestion.threshold)
            : (activeCityRegionQuestion.regionValue === 'east' ? lng >= activeCityRegionQuestion.threshold : lng < activeCityRegionQuestion.threshold);

        return isBlueRegion
            ? {
                color: '#0039A6',
                fillOpacity: 0.30,
                opacity: 0.90,
                weight: 2.5,
                dashArray: null,
                markerWeight: 1.5,
                markerOpacity: 0.95,
                markerFillOpacity: 0.95
            }
            : {
                color: '#767679',
                fillOpacity: 0.24,
                opacity: 0.80,
                weight: 2,
                dashArray: '7, 4',
                markerWeight: 1,
                markerOpacity: 0.8,
                markerFillOpacity: 0.8
            };
    }

    if (
        activeGeoSplitQuestion &&
        Array.isArray(place.coordinates) &&
        place.coordinates.length >= 2
    ) {
        const [lng, lat] = place.coordinates;
        const isBlueRegion = activeGeoSplitQuestion.axis === 'ns'
            ? (activeGeoSplitQuestion.regionValue === 'north' ? lat >= activeGeoSplitQuestion.threshold : lat < activeGeoSplitQuestion.threshold)
            : (activeGeoSplitQuestion.regionValue === 'east' ? lng >= activeGeoSplitQuestion.threshold : lng < activeGeoSplitQuestion.threshold);

        return isBlueRegion
            ? {
                color: '#0039A6',
                fillOpacity: 0.30,
                opacity: 0.90,
                weight: 2.5,
                dashArray: null,
                markerWeight: 1.5,
                markerOpacity: 0.95,
                markerFillOpacity: 0.95
            }
            : {
                color: '#767679',
                fillOpacity: 0.24,
                opacity: 0.80,
                weight: 2,
                dashArray: '7, 4',
                markerWeight: 1,
                markerOpacity: 0.8,
                markerFillOpacity: 0.8
            };
    }

    return null;
}

function zoomToCounty(countyName) {
    if (!gameState.counties || !gameState.counties.features) return;
    
    // Find the county geometry
    const county = gameState.counties.features.find(
        c => (c.properties?.NAME || c.properties?.name) === countyName
    );
    
    if (!county) {
        console.warn(`[Map] County "${countyName}" not found for zoom`);
        return;
    }
    
    // Get bounds of the county
    const countyLayer = L.geoJSON(county);
    const bounds = countyLayer.getBounds();
    
    // Zoom to the county with padding
    gameState.map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 13,
        animate: true,
        duration: 0.8
    });
}

function updateMapMarkers() {
    gameState.mapRenderToken += 1;
    const renderToken = gameState.mapRenderToken;

    // Clear existing markers and polygons
    gameState.markers.clearLayers();
    gameState.polygons.clearLayers();

    if (gameState.candidates.length === 0) return;

    // Sort candidates by probability to find ranges
    const sorted = [...gameState.candidates].sort((a, b) => b.probability - a.probability);
    const maxProb = sorted[0].probability;
    const minProb = sorted[sorted.length - 1].probability;
    


    // Add markers for all current candidates
    const bounds = [];
    
    // Dynamic marker size based on number of candidates
    let baseRadius, borderWeight;
    if (gameState.candidates.length > 10000) {
        baseRadius = 4;  // Very small for many markers
        borderWeight = 1;
    } else if (gameState.candidates.length > 1000) {
        baseRadius = 5;
        borderWeight = 1;
    } else if (gameState.candidates.length > 100) {
        baseRadius = 6;
        borderWeight = 1;
    } else if (gameState.candidates.length > 10) {
        baseRadius = 7;
        borderWeight = 2;
    } else {
        baseRadius = 9;  // Larger when few markers
        borderWeight = 2;
    }
    
    // Render top categories first for responsiveness, while keeping final layering with bringToBack().
    // Within each category, preserve candidate order.
    const { orderedItems: sortedCandidates, categoryRank: candidateCategoryRank } = orderByCategoryFrequency(
        gameState.candidates,
        candidate => candidate.place.fclass,
        { topFirst: PROGRESSIVE_TOP_FIRST_RENDER }
    );
    
    // Check if we have personal locations in candidates
    const hasPersonalLocations = gameState.candidates.some(c => 
        c.place.fclass === 'personal_residence' || c.place.fclass === 'personal_workplace'
    );
    
    // Get unique counties currently in play
    const activeCounties = new Set(gameState.candidates.map(c => c.place.county).filter(Boolean));
    
    // Keep county outlines visible while narrowing, including when one county remains.
    // When only one county remains, keep outline only (no fill) for visual context.
    if (activeCounties.size >= 1 && activeCounties.size <= 50 && gameState.counties.features) {
        // Calculate area for each county and sort by size (largest first)
        const countiesToShow = gameState.counties.features
            .filter(county => {
                const countyName = county.properties?.NAME || county.properties?.name;
                return activeCounties.has(countyName);
            })
            .map(county => {
                const bounds = L.geoJSON(county).getBounds();
                const area = (bounds.getNorth() - bounds.getSouth()) * (bounds.getEast() - bounds.getWest());
                return { county, area };
            })
            .sort((a, b) => b.area - a.area); // Largest first
        

        
        countiesToShow.forEach(({ county }) => {
            const countyName = county.properties?.NAME || county.properties?.name;
            const isSingleRemainingCounty = activeCounties.size === 1;
            
            L.geoJSON(county, {
                style: {
                    fillColor: isSingleRemainingCounty ? 'transparent' : (activeCounties.size <= 8 ? '#0071CE' : '#97CAEB'),
                    fillOpacity: isSingleRemainingCounty ? 0 : (activeCounties.size <= 8 ? 0.20 : 0.12),
                    color: activeCounties.size <= 8 ? '#0039A6' : '#767679',
                    weight: isSingleRemainingCounty ? 2.5 : (activeCounties.size <= 8 ? 2 : 1.5),
                    opacity: isSingleRemainingCounty ? 0.85 : (activeCounties.size <= 8 ? 0.7 : 0.5)
                }
            }).addTo(gameState.polygons).bindTooltip(countyName, {
                permanent: activeCounties.size <= 8,  // Show labels when few counties
                direction: 'center',
                className: 'county-label'
            });
        });
    }
    
    // For personal locations, deduplicate by city to show only one dot per city
    const personalLocationsByCity = new Map();
    const nonPersonalCandidates = [];
    const candidateCounties = new Set(gameState.candidates.map(c => c.place.county).filter(Boolean));
    const hasNarrowedToCounty = candidateCounties.size <= 2;  // 1 or 2 counties only
    const hasConfirmedSingleCounty = candidateCounties.size === 1;
    const activeCityQuestion = gameState.currentQuestion && gameState.currentQuestion.type === 'city'
        ? gameState.currentQuestion
        : null;
    const activeCityRegionQuestion = gameState.currentQuestion && gameState.currentQuestion.type === 'city_region'
        ? gameState.currentQuestion
        : null;
    const activeGeoSplitQuestion = gameState.currentQuestion && gameState.currentQuestion.type === 'geo_split'
        ? gameState.currentQuestion
        : null;
    
    sortedCandidates.forEach(candidate => {
        const isPersonalLocation = candidate.place.fclass === 'personal_residence' || 
                                   candidate.place.fclass === 'personal_workplace';
        
        if (isPersonalLocation) {
            // Only show personal locations if we've narrowed to a county
            if (!hasNarrowedToCounty) {
                return;  // Skip rendering this personal location
            }

            // Once county is confirmed, only show city-level personal locations
            if (hasConfirmedSingleCounty && candidate.place.areaType === 'county') {
                return;
            }

            // If county is confirmed, only keep entries that map to a city
            if (hasConfirmedSingleCounty && !candidate.place.city) {
                return;
            }
            
            // Group by city - keep only the first one per city
            const cityKey = candidate.place.city;
            if (!personalLocationsByCity.has(cityKey)) {
                personalLocationsByCity.set(cityKey, candidate);
            }
        } else {
            nonPersonalCandidates.push(candidate);
        }
    });
    
    // Combine deduplicated personal locations with non-personal candidates
    const candidatesToRender = [...nonPersonalCandidates, ...Array.from(personalLocationsByCity.values())];
    const markerRenderTasks = [];
    const showMarkerTooltips = candidatesToRender.length <= MAX_CANDIDATE_MARKER_TOOLTIPS;
    
    candidatesToRender.forEach(candidate => {
        
        const isPersonalLocation = candidate.place.fclass === 'personal_residence' ||
                       candidate.place.fclass === 'personal_workplace';

        // Personal locations are always shown as specific point markers (no area fills/buffers).
        if (!isPersonalLocation && candidate.place.areaType === 'county' && candidate.place.geometry && !hasConfirmedSingleCounty) {
            // Render county as shaded polygon with striped pattern
            const color = getPlaceColor(candidate.place.fclass);
            const fillOpacity = 0.2;  // Fixed 20% opacity
            
            const polygon = L.geoJSON(candidate.place.geometry, {
                style: {
                    fillColor: color,
                    fillOpacity: fillOpacity,
                    color: color,
                    weight: 2,
                    opacity: 0.7,
                    dashArray: '5, 5'  // Dashed border for personal areas
                }
            }).addTo(gameState.polygons);
            
            polygon.bindTooltip(`
                <strong>${candidate.place.name}</strong><br>
                Type: ${formatFclass(candidate.place.fclass)}<br>
                ${candidate.place.county ? `County: ${candidate.place.county}` : ''}
            `, {
                direction: 'center',
                permanent: false
            });
            
            const [lng, lat] = candidate.place.coordinates;
            bounds.push([lat, lng]);
        } else if (!isPersonalLocation && candidate.place.areaType === 'city') {
            // Render city as circular area or polygon
            const [lng, lat] = candidate.place.coordinates;
            const locationQuestionStyle = getLocationQuestionStyle(candidate.place, activeCityQuestion, activeCityRegionQuestion, activeGeoSplitQuestion);

            let color = getPlaceColor(candidate.place.fclass);
            let fillOpacity = 0.2;
            let weight = 2;
            let opacity = 0.7;
            let dashArray = '5, 5';

            // Personal residence city areas should be GSU blue at lower opacity
            if (candidate.place.fclass === 'personal_residence') {
                color = '#0039A6';
                fillOpacity = 0.15;
            }

            if (locationQuestionStyle) {
                color = locationQuestionStyle.color;
                fillOpacity = locationQuestionStyle.fillOpacity;
                weight = locationQuestionStyle.weight;
                opacity = locationQuestionStyle.opacity;
                dashArray = locationQuestionStyle.dashArray;
            }
            
            if (candidate.place.geometry && candidate.place.geometry.type !== 'Point') {
                // Use polygon if available
                const polygon = L.geoJSON(candidate.place.geometry, {
                    style: {
                        fillColor: color,
                        fillOpacity: fillOpacity,
                        color: color,
                        weight: weight,
                        opacity: opacity,
                        dashArray: dashArray
                    }
                }).addTo(gameState.polygons);
                
                polygon.bindTooltip(`
                    <strong>${candidate.place.name}</strong><br>
                    Type: ${formatFclass(candidate.place.fclass)}<br>
                    ${candidate.place.city ? `City: ${candidate.place.city}` : ''}
                `, {
                    direction: 'center',
                    permanent: false
                });
            } else {
                // Try to use real city boundary polygon from geojson
                const cityName = candidate.place.city || candidate.place.name;
                const cityFeature = cityName ? gameState.cityBoundaries.get(getCityBoundaryKey(cityName)) : null;
                if (cityFeature) {
                    const polygon = L.geoJSON(cityFeature, {
                        style: {
                            fillColor: color,
                            fillOpacity: fillOpacity,
                            color: color,
                            weight: weight,
                            opacity: opacity,
                            dashArray: dashArray
                        }
                    }).addTo(gameState.polygons);
                    polygon.bindTooltip(`
                        <strong>${candidate.place.name}</strong><br>
                        Type: ${formatFclass(candidate.place.fclass)}<br>
                        ${candidate.place.city ? `City: ${candidate.place.city}` : ''}
                    `, {
                        direction: 'center',
                        permanent: false
                    });
                } else {
                    // Last-resort fallback: circle approximation
                    const circle = L.circle([lat, lng], {
                        radius: 5000,
                        fillColor: color,
                        fillOpacity: fillOpacity,
                        color: color,
                        weight: weight,
                        opacity: opacity,
                        dashArray: dashArray
                    }).addTo(gameState.polygons);
                    circle.bindTooltip(`
                        <strong>${candidate.place.name}</strong><br>
                        Type: ${formatFclass(candidate.place.fclass)}<br>
                        ${candidate.place.city ? `City: ${candidate.place.city}` : ''}
                    `, {
                        direction: 'center',
                        permanent: false
                    });
                }
            }
            
            bounds.push([lat, lng]);
        } else {
            // Render as regular marker
            const [lng, lat] = candidate.place.coordinates;
            const locationQuestionStyle = getLocationQuestionStyle(candidate.place, activeCityQuestion, activeCityRegionQuestion, activeGeoSplitQuestion);
            
            // Color based on place category
            const color = locationQuestionStyle ? locationQuestionStyle.color : getPlaceColor(candidate.place.fclass);
            const radius = baseRadius;

            markerRenderTasks.push(() => {
                const marker = L.circleMarker([lat, lng], {
                    radius: radius,
                    fillColor: color,
                    color: color,
                    weight: locationQuestionStyle ? locationQuestionStyle.markerWeight : 0,
                    opacity: locationQuestionStyle ? locationQuestionStyle.markerOpacity : 0.7,
                    fillOpacity: locationQuestionStyle ? locationQuestionStyle.markerFillOpacity : 0.7,
                    renderer: gameState.pointRenderer
                }).addTo(gameState.markers);

                if (PROGRESSIVE_TOP_FIRST_RENDER) {
                    const rank = candidateCategoryRank.get(candidate.place.fclass || 'unknown') || 0;
                    if (rank > 0) {
                        marker.bringToBack();
                    }
                }

                if (showMarkerTooltips) {
                    marker.bindTooltip(`
                        <strong>${candidate.place.name}</strong><br>
                        Type: ${formatFclass(candidate.place.fclass)}<br>
                        ${candidate.place.city ? `City: ${candidate.place.city}<br>` : ''}
                        ${candidate.place.county ? `County: ${candidate.place.county}` : ''}
                    `, {
                        direction: 'top',
                        offset: [0, -5]
                    });
                }
            });

            bounds.push([lat, lng]);
        }
    });

    const finalizeMapUpdate = () => {
        if (renderToken !== gameState.mapRenderToken) return;

        // Dynamically zoom map to fit all current candidates
        if (bounds.length > 0) {
            // Calculate what zoom level would be needed
            const targetBounds = L.latLngBounds(bounds);
            const targetZoom = gameState.map.getBoundsZoom(targetBounds, false, [50, 50]);

            // Only apply fitBounds if it would zoom in (not out)
            // This prevents zooming out when candidates still span a large area
            if (targetZoom >= 8) {
                gameState.map.fitBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 16,
                    animate: true,
                    duration: 0.5
                });
            } else {
                // If fitBounds would zoom out below 8, just stay at current zoom
                // But center on the bounds
                const center = targetBounds.getCenter();
                const currentZoom = gameState.map.getZoom();
                if (currentZoom < 8) {
                    gameState.map.setView(center, 8, { animate: true, duration: 0.5 });
                }
            }
        }

        // Update legend to show only active categories
        updateMapLegend();
    };

    runMarkerRenderTasks(markerRenderTasks, renderToken, finalizeMapUpdate);
}

function updateMapLegend() {
    // Get unique categories from current candidates, or all places when candidates are not ready
    const sourcePlaces = gameState.candidates.length
        ? gameState.candidates.map(c => c.place).filter(Boolean)
        : (Array.isArray(gameState.places) ? gameState.places : []);

    const activeCategories = new Set();
    sourcePlaces.forEach(place => {
        const color = getPlaceColor(place.fclass);
        activeCategories.add(color);
    });
    
    // Map colors to category names
    const categoryInfo = {
        '#CC0000': 'Food & Dining',
        '#9B59B6': 'Shopping',
        '#0039A6': 'Education',
        '#27AE60': 'Healthcare',
        '#00AEEF': 'Tourism',
        '#16A085': 'Accommodation',
        '#E67E22': 'Recreation',
        '#0071CE': 'Government',
        '#F39C12': 'Transportation',
        '#97CAEB': 'Cities/Towns',
        '#767679': 'Utilities',
        '#E91E63': 'Personal Places',
        '#8E44AD': 'Religious',
        '#795548': 'Outdoor'
    };
    
    // Update legend display
    const legendBody = document.querySelector('.map-legend-body');
    if (legendBody) {
        legendBody.innerHTML = '';
        
        // Add legend items for active categories only
        Object.entries(categoryInfo).forEach(([color, name]) => {
            if (activeCategories.has(color)) {
                const item = document.createElement('div');
                item.className = 'legend-item';
                item.innerHTML = `<span class="legend-dot" style="background: ${color};"></span>${name}`;
                legendBody.appendChild(item);
            }
        });
    }
}

function initializeMapOverlayToggles() {
    const finder = document.getElementById('mapFinder');
    const finderToggle = document.getElementById('mapFinderToggle');
    const legend = document.querySelector('.map-legend');
    const legendToggle = document.getElementById('mapLegendToggle');

    if (finder && finderToggle) {
        const syncFinderButton = () => {
            const expanded = !finder.classList.contains('minimized');
            finderToggle.textContent = '';
            finderToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            finderToggle.setAttribute('aria-label', expanded ? 'Hide location finder' : 'Show location finder');
            finderToggle.title = expanded ? 'Hide location finder' : 'Show location finder';
        };
        syncFinderButton();
        finderToggle.addEventListener('click', () => {
            finder.classList.toggle('minimized');
            syncFinderButton();
        });
    }

    if (legend && legendToggle) {
        const syncLegendButton = () => {
            const expanded = !legend.classList.contains('minimized');
            legendToggle.textContent = expanded ? 'x' : '-';
            legendToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            legendToggle.setAttribute('aria-label', expanded ? 'Hide legend' : 'Show legend');
            legendToggle.title = expanded ? 'Hide legend' : 'Show legend';
        };
        syncLegendButton();
        legendToggle.addEventListener('click', () => {
            legend.classList.toggle('minimized');
            syncLegendButton();
        });
    }
}

function highlightGuessPlace(place) {
    // Temporarily highlight the guessed place
    const [lng, lat] = place.coordinates;
    
    // Clear existing markers and add a special marker for the guess
    gameState.markers.clearLayers();
    
    const marker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'guess-marker',
            html: '<div style="background: #0071CE; color: white; padding: 8px; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 3px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.3); animation: pulse 1s infinite;">?</div><style>@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }</style>',
            iconSize: [30, 30]
        })
    }).addTo(gameState.markers);

    marker.bindPopup(`
        <strong style="font-size: 16px;">${place.name}</strong><br>
        Type: ${formatFclass(place.fclass)}<br>
        ${place.city ? `City: ${place.city}<br>` : ''}
        ${place.county ? `County: ${place.county}` : ''}
    `).openPopup();
    
    // Zoom to the guessed place
    gameState.map.setView([lat, lng], 14, {
        animate: true,
        duration: 0.5
    });
}

function highlightFinalPlace(place) {
    gameState.markers.clearLayers();
    
    const [lng, lat] = place.coordinates;
    
    // Add a special marker for the final guess
    const marker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'final-marker',
            html: '<div style="background: #00AEEF; color: white; padding: 10px; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 24px; border: 3px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">★</div>',
            iconSize: [40, 40]
        })
    }).addTo(gameState.markers);

    marker.bindPopup(`
        <strong style="font-size: 16px;">${place.name}</strong><br>
        Type: ${place.fclass}<br>
        ${place.city ? `City: ${place.city}<br>` : ''}
        ${place.county ? `County: ${place.county}` : ''}
    `).openPopup();
    
    // Zoom to the final place (use wider zoom for personal area-based locations)
    const isPersonalLocation = place.fclass === 'personal_residence' || place.fclass === 'personal_workplace';
    let finalZoom = 15;

    if (isPersonalLocation) {
        if (place.areaType === 'county') {
            finalZoom = 10;
        } else if (place.areaType === 'city') {
            finalZoom = 12;
        } else {
            finalZoom = 13;
        }
    }

    gameState.map.setView([lat, lng], finalZoom, {
        animate: true,
        duration: 0.5
    });
}

function normalizeQuestionToken(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s_\-|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getQuestionIntentKey(questionLike) {
    if (!questionLike || !questionLike.type) return null;

    const type = questionLike.type;
    const value = normalizeQuestionToken(questionLike.value);

    // Canonicalize semantically equivalent question variants so they can’t be asked twice.
    // Example: "personal_location_broad" (ambiguous) and "personal_location" (fclass_group)
    // should share one intent key.
    if (value === 'personal_location_broad' || value === 'personal_location') {
        return 'intent:personal_location';
    }

    // Canonicalize K-12 umbrella variants (fclass school, name-pattern k12, ambiguous k12_school)
    // so semantically equivalent school-level questions are never asked twice.
    if (
        value === 'k12_school' ||
        value === 'k12' ||
        (type === 'fclass' && value === 'school')
    ) {
        return 'intent:k12_school';
    }

    if (type === 'region') {
        const axisRaw = questionLike.axis || (
            value === 'north' || value === 'south' ? 'ns' :
            (value === 'east' || value === 'west' ? 'ew' : value)
        );
        return `region:${normalizeQuestionToken(axisRaw)}`;
    }

    if (type === 'city_region') {
        const parsed = String(value || '').split(':');
        const inferredCounty = questionLike.county || (parsed.length > 1 ? parsed.slice(1).join(':') : '');
        const inferredAxis = questionLike.axis || (
            parsed[0] === 'north' || parsed[0] === 'south' ? 'ns' :
            (parsed[0] === 'east' || parsed[0] === 'west' ? 'ew' : parsed[0])
        );
        return `city_region:${normalizeQuestionToken(inferredCounty)}:${normalizeQuestionToken(inferredAxis)}`;
    }

    if (type === 'city') return `city:${value}`;
    if (type === 'county') return `county:${value}`;

    if (type === 'name_token') {
        return `name:${normalizeQuestionToken(questionLike.token || value)}`;
    }

    if (type === 'name_prefix') {
        return `name:${normalizeQuestionToken(questionLike.prefix || value)}`;
    }

    if (type === 'name_pattern') {
        if (value.startsWith('pattern_')) return `name:${value.replace('pattern_', '')}`;
        if (value.startsWith('brand_')) return `name:${value.replace('brand_', '')}`;
        return `name:${normalizeQuestionToken(questionLike.pattern || value)}`;
    }

    return `${type}:${value}`;
}

// ============================================
// PRIORITY QUEUE (MAX-HEAP) — BST/HUFFMAN QUESTION SELECTION
// Each question is scored by information_gain = min(matches, N - matches),
// which is maximized at a perfect 50/50 split (binary search / Huffman optimal).
// ============================================

class QuestionPriorityQueue {
    constructor() {
        this.heap = [];
    }

    enqueue(question) {
        this.heap.push(question);
        this._bubbleUp(this.heap.length - 1);
    }

    _bubbleUp(index) {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[parentIndex].information_gain >= this.heap[index].information_gain) break;
            [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
            index = parentIndex;
        }
    }

    dequeue() {
        const max = this.heap[0];
        const last = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = last;
            this._sinkDown(0);
        }
        return max;
    }

    _sinkDown(index) {
        const n = this.heap.length;
        while (true) {
            let largest = index;
            const left  = 2 * index + 1;
            const right = 2 * index + 2;
            if (left  < n && this.heap[left].information_gain  > this.heap[largest].information_gain) largest = left;
            if (right < n && this.heap[right].information_gain > this.heap[largest].information_gain) largest = right;
            if (largest === index) break;
            [this.heap[largest], this.heap[index]] = [this.heap[index], this.heap[largest]];
            index = largest;
        }
    }

    isEmpty() { return this.heap.length === 0; }
    size()    { return this.heap.length; }
}

// ============================================
// QUESTION GENERATION LOGIC
// ============================================

function generateQuestion() {
    // Analyze current candidates to find the best question to ask
    // Best question = one that splits candidates most evenly
    
    const candidates = gameState.candidates;
    
    if (candidates.length === 0) {
        return null;
    }

    // Check if we've hit the question limit
    if (gameState.questionCount >= gameState.maxQuestions) {
        // Don't automatically guess - let user decide to continue or stop
        return null;
    }


    // Only guess if the top candidate is >75% likely, or if only 1 remains
    const sorted = [...candidates].sort((a, b) => b.probability - a.probability);
    const remainingCounties = new Set(candidates.map(c => c.place.county).filter(Boolean));
    const remainingCities = new Set(candidates.map(c => c.place.city).filter(Boolean));
    const countyResolved = remainingCounties.size <= 1;
    const cityResolved = remainingCities.size <= 1;
    const locationResolved = countyResolved && (remainingCities.size === 0 || cityResolved);

    // On the last available question, allow a grouped personal-location guess
    // e.g., "a residence in Atlanta" instead of forcing relationship subtype.
    const questionsRemaining = gameState.maxQuestions - gameState.questionCount;
    if (questionsRemaining <= 1) {
        const personalCandidates = candidates.filter(c =>
            c.place.fclass === 'personal_residence' || c.place.fclass === 'personal_workplace'
        );

        if (personalCandidates.length > 0 && personalCandidates.length === candidates.length) {
            const personalTypes = new Set(personalCandidates.map(c => c.place.fclass));
            const personalLocations = new Set(personalCandidates.map(c => c.place.city || c.place.county).filter(Boolean));
            const personalRelationships = new Set(personalCandidates.map(c => c.place.relationship).filter(Boolean));

            if (locationResolved && personalTypes.size === 1 && personalLocations.size === 1 && personalRelationships.size > 1) {
                const representative = sorted[0].place;
                const fclass = Array.from(personalTypes)[0];
                const locationLabel = representative.city || representative.county;
                const genericTypeLabel = fclass === 'personal_residence' ? 'residence' : 'workplace';

                return {
                    type: 'guess',
                    place: representative,
                    displayName: `a ${genericTypeLabel} in ${locationLabel}`,
                    guessGroup: {
                        fclass: fclass,
                        locationKey: locationLabel
                    }
                };
            }
        }
    }

    if (sorted.length === 1) {
        return {
            type: 'guess',
            place: sorted[0].place
        };
    }

    // Avoid early guessing: only guess when candidate pool is genuinely small.
    const topProbability = sorted[0]?.probability || 0;
    const secondProbability = sorted[1]?.probability || 0;
    if (
        locationResolved &&
        sorted.length <= 3 &&
        topProbability > 0.88 &&
        topProbability > secondProbability
    ) {
        return {
            type: 'guess',
            place: sorted[0].place
        };
    }

    // Late-stage guardrail: when question budget is tight, allow an earlier best-guess
    // to avoid spending multiple low-yield questions near the 20-question cap.
    if (
        questionsRemaining <= 3 &&
        sorted.length <= 6 &&
        topProbability >= 0.55 &&
        topProbability > secondProbability
    ) {
        return {
            type: 'guess',
            place: sorted[0].place
        };
    }

    // Analyze different question types
    const questionCandidates = [];

    // 1. Ambiguous/fun questions based on place characteristics
    const ambiguousQuestions = generateAmbiguousQuestions(candidates);
    questionCandidates.push(...ambiguousQuestions);

    // 2. Questions about fclass (type of place)
    const fclasses = {};
    const fclassCounts = {};
    
    // Group similar place types together
    const fclassGroups = {
        'supermarket': 'grocery_shopping',
        'convenience': 'grocery_shopping',
        'grocery_store': 'grocery_shopping',
        'grocery': 'grocery_shopping',
        'christian': 'place_of_worship',
        'christian_anglican': 'place_of_worship',
        'christian_catholic': 'place_of_worship',
        'christian_evangelical': 'place_of_worship',
        'christian_lutheran': 'place_of_worship',
        'christian_methodist': 'place_of_worship',
        'christian_orthodox': 'place_of_worship',
        'christian_protestant': 'place_of_worship',
        'muslim': 'place_of_worship',
        'muslim_shia': 'place_of_worship',
        'muslim_sunni': 'place_of_worship',
        'jewish': 'place_of_worship',
        'hindu': 'place_of_worship',
        'buddhist': 'place_of_worship',
        'sikh': 'place_of_worship'
    };
    
    candidates.forEach(c => {
        if (c.place.fclass) {
            // Use grouped name if applicable, otherwise use original
            const normalizedFclass = fclassGroups[c.place.fclass] || c.place.fclass;
            fclasses[normalizedFclass] = (fclasses[normalizedFclass] || 0) + c.probability;
            fclassCounts[normalizedFclass] = (fclassCounts[normalizedFclass] || 0) + 1;
        }
    });

    // Special case: If we have schools, colleges, AND universities, ask about educational level first
    const hasSchools = fclassCounts['school'] >= 3;
    const hasColleges = fclassCounts['college'] >= 2;
    const hasUniversities = fclassCounts['university'] >= 2;
    
    if ((hasSchools && hasColleges) || (hasSchools && hasUniversities) || (hasColleges && hasUniversities)) {
        // Only add K-12 split if there are enough true K-12 schools (elementary, middle, high), not just any 'school' fclass
        const k12Candidates = candidates.filter(c => c.place.fclass === 'school' && (
            /elementary|middle|high/i.test(c.place.name)
        ));
        const k12Count = k12Candidates.length;
        if (k12Count >= 5 && k12Count < candidates.length - 2) {
            questionCandidates.unshift({
                type: 'name_pattern',
                value: 'k12',
                text: 'Is it an elementary, middle, or high school?',
                pattern: 'elementary|middle|high',
                fclass: 'school',
                parent: null,
                children: ['elementary', 'middle', 'high'],
                description: 'Covers all elementary, middle, and high schools.',
                split: Math.abs(k12Count - (candidates.length - k12Count)) / candidates.length,
                count: k12Count
            });
        }
    }

    for (const [fclass, prob] of Object.entries(fclasses)) {
        const split = Math.abs(prob - (candidates.reduce((sum, c) => sum + c.probability, 0) - prob));
        const count = fclassCounts[fclass];
        
        // Skip if ALL candidates are this type (asking wouldn't narrow anything)
        if (count === candidates.length) {
            continue;
        }
        
        // Skip very rare types early in the game (< 5 candidates before question 15),
        // but NEVER skip university or college
        if (gameState.questionCount < 15 && count < 5 && fclass !== 'university' && fclass !== 'college') {
            continue;
        }
        
        // Special handling for grouped grocery shopping
        if (fclass === 'grocery_shopping') {
            questionCandidates.push({
                type: 'fclass_group',
                value: 'grocery_shopping',
                text: 'Is it a supermarket or grocery store?',
                matches: ['supermarket', 'convenience', 'grocery_store', 'grocery'],
                description: 'Includes supermarkets, grocery stores, and convenience stores.',
                split: split,
                count: count
            });
        } else if (fclass === 'place_of_worship') {
            questionCandidates.push({
                type: 'fclass_group',
                value: 'place_of_worship',
                text: 'Is it a place of worship?',
                matches: [
                    'christian', 'christian_anglican', 'christian_catholic', 'christian_evangelical',
                    'christian_lutheran', 'christian_methodist', 'christian_orthodox', 'christian_protestant',
                    'muslim', 'muslim_shia', 'muslim_sunni', 'jewish', 'hindu', 'buddhist', 'sikh'
                ],
                description: 'Includes churches, mosques, synagogues, temples, and other worship sites.',
                split: split,
                count: count
            });
        } else {
            // If fclass is 'school' and there are also colleges or universities, clarify as K-12
            let questionText = `Is it a ${formatFclass(fclass)}?`;
            if (fclass === 'school' && (fclassCounts['college'] > 0 || fclassCounts['university'] > 0)) {
                questionText = 'Is it a K-12 school (elementary, middle, or high school)?';
            }
            questionCandidates.push({
                type: 'fclass',
                value: fclass,
                text: questionText,
                description: `This asks whether the place type is ${formatFclass(fclass)}.`,
                split: split,
                count: count
            });
        }
    }

    // 3. Name-based questions to distinguish between similar places (e.g., school types)
    // This helps narrow down when there are many places of the same type
    
    // Check if we have many schools - ask about school level
    const schoolCandidates = candidates.filter(c => c.place.fclass === 'school');
    if (schoolCandidates.length >= 5) {
        // Elementary school
        const elementaryCount = schoolCandidates.filter(c => 
            c.place.name.toLowerCase().includes('elementary')
        ).length;
        if (elementaryCount >= 3 && elementaryCount < schoolCandidates.length - 2) {
            questionCandidates.push({
                type: 'name_pattern',
                value: 'elementary',
                text: 'Is it an elementary school?',
                pattern: 'elementary',
                fclass: 'school',
                parent: 'k12',
                children: null,
                description: 'Specifically asks if the place is an elementary school.',
                split: Math.abs(elementaryCount - (schoolCandidates.length - elementaryCount)) / schoolCandidates.length,
                count: elementaryCount
            });
        }
        // Middle school
        const middleCount = schoolCandidates.filter(c => 
            c.place.name.toLowerCase().includes('middle')
        ).length;
        if (middleCount >= 3 && middleCount < schoolCandidates.length - 2) {
            questionCandidates.push({
                type: 'name_pattern',
                value: 'middle',
                text: 'Is it a middle school?',
                pattern: 'middle',
                fclass: 'school',
                parent: 'k12',
                children: null,
                description: 'Specifically asks if the place is a middle school.',
                split: Math.abs(middleCount - (schoolCandidates.length - middleCount)) / schoolCandidates.length,
                count: middleCount
            });
        }
        // High school
        const highCount = schoolCandidates.filter(c => 
            c.place.name.toLowerCase().includes('high')
        ).length;
        if (highCount >= 3 && highCount < schoolCandidates.length - 2) {
            questionCandidates.push({
                type: 'name_pattern',
                value: 'high',
                text: 'Is it a high school?',
                pattern: 'high',
                fclass: 'school',
                parent: 'k12',
                children: null,
                description: 'Specifically asks if the place is a high school.',
                split: Math.abs(highCount - (schoolCandidates.length - highCount)) / schoolCandidates.length,
                count: highCount
            });
        }
    }

    // Higher-education specific naming questions for better narrowing before guessing.
    const higherEdCandidates = candidates.filter(c =>
        c.place.fclass === 'university' || c.place.fclass === 'college'
    );
    if (higherEdCandidates.length >= 8) {
        const higherEdPatterns = [
            { token: 'state', text: 'Does the name include "State"?', description: 'Many public institutions include "State" in the name.' },
            { token: 'tech', text: 'Does the name include "Tech" or "Technical"?', description: 'Identifies technical institutes and technology-focused schools.' },
            { token: 'community', text: 'Does the name include "Community"?', description: 'Distinguishes community colleges from larger universities.' },
            { token: 'georgia', text: 'Does the name include "Georgia"?', description: 'Separates Georgia-branded institutions from others.' },
            { token: 'christian', text: 'Does the name include "Christian"?', description: 'Identifies religiously affiliated institutions by name.' }
        ];

        higherEdPatterns.forEach(({ token, text, description }) => {
            const matchCount = higherEdCandidates.filter(c => {
                const name = c.place.name.toLowerCase();
                if (token === 'tech') {
                    return name.includes('tech') || name.includes('technical');
                }
                return name.includes(token);
            }).length;

            if (matchCount >= 2 && matchCount <= higherEdCandidates.length - 2) {
                questionCandidates.push({
                    type: 'name_pattern',
                    value: `highered_${token}`,
                    text,
                    pattern: token === 'tech' ? 'tech|technical' : token,
                    prefix: false,
                    description,
                    split: Math.abs(matchCount - (higherEdCandidates.length - matchCount)) / higherEdCandidates.length,
                    count: matchCount
                });
            }
        });
    }

    // 3b. Worship follow-up questions (only after confirming it's a place of worship)
    const worshipFclasses = [
        'christian', 'christian_anglican', 'christian_catholic', 'christian_evangelical',
        'christian_lutheran', 'christian_methodist', 'christian_orthodox', 'christian_protestant',
        'muslim', 'muslim_shia', 'muslim_sunni', 'jewish', 'hindu', 'buddhist', 'sikh'
    ];
    const worshipCandidates = candidates.filter(c => worshipFclasses.includes(c.place.fclass));

    if (worshipCandidates.length >= 3) {
        const denominationGroups = [
            {
                value: 'worship_christian',
                text: 'Is it a Christian place of worship?',
                description: 'Includes churches and Christian denominations.',
                matches: [
                    'christian', 'christian_anglican', 'christian_catholic', 'christian_evangelical',
                    'christian_lutheran', 'christian_methodist', 'christian_orthodox', 'christian_protestant'
                ]
            },
            {
                value: 'worship_muslim',
                text: 'Is it a Muslim place of worship?',
                description: 'Includes mosques and Muslim denominations.',
                matches: ['muslim', 'muslim_shia', 'muslim_sunni']
            },
            {
                value: 'worship_jewish',
                text: 'Is it a Jewish place of worship?',
                description: 'Includes synagogues and Jewish worship sites.',
                matches: ['jewish']
            },
            {
                value: 'worship_hindu',
                text: 'Is it a Hindu place of worship?',
                description: 'Includes Hindu temples and worship sites.',
                matches: ['hindu']
            },
            {
                value: 'worship_buddhist',
                text: 'Is it a Buddhist place of worship?',
                description: 'Includes Buddhist temples and worship sites.',
                matches: ['buddhist']
            },
            {
                value: 'worship_sikh',
                text: 'Is it a Sikh place of worship?',
                description: 'Includes Sikh gurdwaras and worship sites.',
                matches: ['sikh']
            }
        ];

        denominationGroups.forEach(group => {
            const matchCount = worshipCandidates.filter(c => group.matches.includes(c.place.fclass)).length;
            if (matchCount >= 1 && matchCount < worshipCandidates.length) {
                questionCandidates.push({
                    type: 'fclass_group',
                    value: group.value,
                    text: group.text,
                    description: group.description,
                    matches: group.matches,
                    parent: 'place_of_worship',
                    split: Math.abs(matchCount - (worshipCandidates.length - matchCount)) / worshipCandidates.length,
                    count: matchCount
                });
            }
        });
    }
    
    // Dynamic intelligent pattern discovery - analyzes candidate names to find useful questions
    // This makes the AI feel like a genie discovering new questions
    const dynamicQuestions = discoverNamePatterns(candidates);
    questionCandidates.push(...dynamicQuestions);

    // Adaptive token-based name questions for late-game narrowing when fixed patterns are exhausted.
    const adaptiveNameQuestions = generateAdaptiveNameQuestions(candidates);
    questionCandidates.push(...adaptiveNameQuestions);

    // Generic late-game micro-splits for small pools to avoid dead ends.
    if (candidates.length <= 20) {
        const lateGameSplitQuestions = generateLateGameSplitQuestions(candidates);
        questionCandidates.push(...lateGameSplitQuestions);
    }

    // 4. Questions about city
    // Prioritize area narrowing early so we avoid repetitive type-only questioning.
    const isPersonalLocations = candidates.some(c => c.place.fclass === 'personal_residence' || c.place.fclass === 'personal_workplace');
    const uniqueCountiesInPlay = new Set(candidates.map(c => c.place.county).filter(Boolean));
    const uniqueCitiesInPlay = new Set(candidates.map(c => c.place.city).filter(Boolean));
    const hasMultipleCounties = uniqueCountiesInPlay.size > 1;
    const hasMeaningfulLocationSpread = hasMultipleCounties || uniqueCitiesInPlay.size > 1 || isPersonalLocations;
    // Allow location/region questions from the very first question when they provide a useful split.
    const shouldAskLocation = hasMeaningfulLocationSpread;
    
    if (shouldAskLocation) {
        // If narrowed to a single county, ask directional city-region questions first
        const countySet = new Set(candidates.map(c => c.place.county).filter(Boolean));
        const focusCounty = countySet.size === 1 ? Array.from(countySet)[0] : null;

        if (focusCounty) {
            const uniqueCityPoints = new Map();

            candidates.forEach(c => {
                if (
                    c.place.county === focusCounty &&
                    c.place.city &&
                    Array.isArray(c.place.coordinates) &&
                    c.place.coordinates.length >= 2 &&
                    !uniqueCityPoints.has(c.place.city)
                ) {
                    const [lng, lat] = c.place.coordinates;
                    uniqueCityPoints.set(c.place.city, { city: c.place.city, lat, lng });
                }
            });

            const cityPoints = Array.from(uniqueCityPoints.values());
            if (cityPoints.length >= 3) {
                const sortedLats = cityPoints.map(p => p.lat).sort((a, b) => a - b);
                const sortedLngs = cityPoints.map(p => p.lng).sort((a, b) => a - b);
                const medianLat = sortedLats[Math.floor(sortedLats.length / 2)];
                const medianLng = sortedLngs[Math.floor(sortedLngs.length / 2)];

                const northCount = cityPoints.filter(p => p.lat >= medianLat).length;
                const southCount = cityPoints.length - northCount;
                if (northCount >= 1 && southCount >= 1) {
                    questionCandidates.push({
                        type: 'city_region',
                        value: `north:${focusCounty}`,
                        regionValue: 'north',
                        axis: 'ns',
                        county: focusCounty,
                        threshold: medianLat,
                        text: `Is it in the northern part of ${focusCounty} County?`,
                        description: 'In this county, the northern part is <span style="color: #0039A6; font-weight: bold;">blue</span> and the southern part is <span style="color: #767679; font-weight: bold;">gray</span>.',
                        split: Math.abs(northCount - southCount) / cityPoints.length,
                        count: northCount
                    });
                }

                const eastCount = cityPoints.filter(p => p.lng >= medianLng).length;
                const westCount = cityPoints.length - eastCount;
                if (eastCount >= 1 && westCount >= 1) {
                    questionCandidates.push({
                        type: 'city_region',
                        value: `east:${focusCounty}`,
                        regionValue: 'east',
                        axis: 'ew',
                        county: focusCounty,
                        threshold: medianLng,
                        text: `Is it in the eastern part of ${focusCounty} County?`,
                        description: 'In this county, the eastern part is <span style="color: #0039A6; font-weight: bold;">blue</span> and the western part is <span style="color: #767679; font-weight: bold;">gray</span>.',
                        split: Math.abs(eastCount - westCount) / cityPoints.length,
                        count: eastCount
                    });
                }
            }
        }

        // City questions
        const cities = {};
        const cityCounts = {};
        candidates.forEach(c => {
            if (c.place.city) {
                cities[c.place.city] = (cities[c.place.city] || 0) + c.probability;
                cityCounts[c.place.city] = (cityCounts[c.place.city] || 0) + 1;
            }
        });

        const uniqueCityCount = Object.keys(cityCounts).length;
        const schoolLikeCount = candidates.filter(c => c.place.fclass === 'school' || c.place.fclass === 'kindergarten').length;
        const schoolDominantForCityNarrowing = candidates.length > 0 && (schoolLikeCount / candidates.length) >= 0.6;
        const allowFocusedCityQuestions = uniqueCityCount <= 2 || (focusCounty && schoolDominantForCityNarrowing && uniqueCityCount <= 12);

        if (allowFocusedCityQuestions) {
            for (const [city, prob] of Object.entries(cities)) {
                const count = cityCounts[city];
                // Skip if ALL candidates are in this city (asking wouldn't narrow anything)
                if (count === candidates.length) {
                    continue;
                }
                const split = Math.abs(prob - (candidates.reduce((sum, c) => sum + c.probability, 0) - prob));
                questionCandidates.push({
                    type: 'city',
                    value: city,
                    text: `Is it in ${city}?`,
                    description: `${city} is highlighted on the map as the target city for this question.`,
                    split: split,
                    count: count
                });
            }
        }
    }

    // 5. Questions about county regions (smarter than asking each county individually)
    if (shouldAskLocation) {
        // First, ask about geographic regions to eliminate multiple counties at once
        const countyRegions_ns = {};
        const countyRegions_ew = {};
        
        candidates.forEach(c => {
            if (c.place.county && gameState.counties.features) {
                const countyData = gameState.counties.features.find(
                    county => (county.properties?.NAME || county.properties?.name) === c.place.county
                );
                if (countyData) {
                    countyRegions_ns[countyData.region_ns] = (countyRegions_ns[countyData.region_ns] || 0) + 1;
                    countyRegions_ew[countyData.region_ew] = (countyRegions_ew[countyData.region_ew] || 0) + 1;
                }
            }
        });
        
        // Ask north/south if it would meaningfully split candidates
        if (countyRegions_ns.north >= 1 && countyRegions_ns.south >= 1) {
            const northCount = countyRegions_ns.north || 0;
            const southCount = countyRegions_ns.south || 0;
            const total = northCount + southCount;
            if (total > 0) {
                questionCandidates.push({
                    type: 'region',
                    value: 'north',
                    axis: 'ns',
                    text: 'Is it in the northern half of Georgia?',
                    description: 'On the map, the northern part is in <span style="color: #0039A6; font-weight: bold;">blue</span> and the southern part is in <span style="color: #767679; font-weight: bold;">gray</span>.',
                    split: Math.abs(northCount - southCount) / total,
                    count: northCount
                });
            }
        }
        
        // Ask east/west if it would meaningfully split candidates
        if (countyRegions_ew.east >= 1 && countyRegions_ew.west >= 1) {
            const eastCount = countyRegions_ew.east || 0;
            const westCount = countyRegions_ew.west || 0;
            const total = eastCount + westCount;
            if (total > 0) {
                questionCandidates.push({
                    type: 'region',
                    value: 'east',
                    axis: 'ew',
                    text: 'Is it in the eastern half of Georgia?',
                    description: 'On the map, the eastern part is in <span style="color: #0039A6; font-weight: bold;">blue</span> and the western part is in <span style="color: #767679; font-weight: bold;">gray</span>.',
                    split: Math.abs(eastCount - westCount) / total,
                    count: eastCount
                });
            }
        }
        
        // Then ask about specific counties (only if regions haven't narrowed it enough)
        const counties = {};
        const countyCounts = {};
        candidates.forEach(c => {
            if (c.place.county) {
                counties[c.place.county] = (counties[c.place.county] || 0) + c.probability;
                countyCounts[c.place.county] = (countyCounts[c.place.county] || 0) + 1;
            }
        });

        const uniqueCountyCount = Object.keys(countyCounts).length;
        if (uniqueCountyCount <= 2) {
            for (const [county, prob] of Object.entries(counties)) {
                const count = countyCounts[county];
                // Skip if ALL candidates are in this county (asking wouldn't narrow anything)
                if (count === candidates.length) {
                    continue;
                }
                const split = Math.abs(prob - (candidates.reduce((sum, c) => sum + c.probability, 0) - prob));
                questionCandidates.push({
                    type: 'county',
                    value: county,
                    text: `Is it in ${county} County?`,
                    description: `${county} County is highlighted in <span style="color: #0039A6; font-weight: bold;">blue</span> on the map. Other eligible counties are shown in <span style="color: #767679; font-weight: bold;">gray</span>.`,
                    split: split,
                    count: count
                });
            }
        }
    }

    // 6. Questions about personal locations (residence/workplace)
    const personalCandidates = candidates.filter(c => 
        c.place.fclass === 'personal_residence' || c.place.fclass === 'personal_workplace'
    );
    
    if (personalCandidates.length > 0) {
        // Ask if it's a personal location first
        const personalCount = personalCandidates.length;
        const personalPercent = personalCount / candidates.length;
        
        if (personalPercent >= 0.05 && personalPercent <= 0.95) {
            questionCandidates.push({
                type: 'fclass_group',
                value: 'personal_location',
                text: 'Is it a private personal location (someone\'s home or workplace) that usually would not appear as a public map place?',
                matches: ['personal_residence', 'personal_workplace'],
                description: 'Private places tied to a person (for example a home or workplace), not typical public landmarks or businesses on a map.',
                split: Math.abs(personalPercent - 0.5),
                count: personalCount
            });
        }
        
        // If many personal locations, ask about residence vs workplace
        // BUT: Skip if we already answered the "residence" question (which only matches personal_residence)
        const hasAnsweredResidence = gameState.decisionTree.some(d => d.value === 'residence');
        
        if (personalCount >= 5 && !hasAnsweredResidence) {
            const residences = candidates.filter(c => c.place.fclass === 'personal_residence');
            const workplaces = candidates.filter(c => c.place.fclass === 'personal_workplace');
            
            if (residences.length >= 2 && workplaces.length >= 2) {
                questionCandidates.push({
                    type: 'fclass',
                    value: 'personal_residence',
                    text: 'Is it where someone lives (a house)?',
                    description: 'Separates residences from workplaces among personal locations.',
                    split: Math.abs(residences.length - workplaces.length) / personalCount,
                    count: residences.length
                });
            }
        }
        
        // Ask about relationships only after personal type and location are narrowed
        const personalLocationConfirmed = gameState.decisionTree.some(
            d => d.type === 'fclass_group' && d.value === 'personal_location' && d.answer === 'yes'
        );
        const hasAnsweredResidenceType = gameState.decisionTree.some(
            d => (d.type === 'fclass' && d.value === 'personal_residence') || (d.type === 'ambiguous' && d.value === 'residence')
        );
        const residenceAnsweredNo = gameState.decisionTree.some(
            d => ((d.type === 'fclass' && d.value === 'personal_residence') || (d.type === 'ambiguous' && d.value === 'residence')) && d.answer === 'no'
        );
        const personalTypeResolved = hasAnsweredResidenceType || (personalLocationConfirmed && residenceAnsweredNo);

        const relationships = {};
        personalCandidates.forEach(c => {
            if (c.place.relationship) {
                relationships[c.place.relationship] = (relationships[c.place.relationship] || 0) + 1;
            }
        });
        
        const relationshipLabels = {
            'mine': 'yours',
            'family': 'a family member\'s',
            'friend': 'a friend\'s',
            'relative': 'a relative\'s',
            'coworker': 'a coworker\'s',
            'coach': 'your coach\'s',
            'teacher': 'your teacher\'s',
            'boss': 'your boss\'s',
            'celebrity': 'a celebrity\'s',
            'neighbor': 'a neighbor\'s'
        };
        
        // Smart hierarchical relationship questions
        const uniqueCounties = new Set(candidates.map(c => c.place.county).filter(Boolean));
        const uniquePersonalCities = new Set(personalCandidates.map(c => c.place.city || c.place.county).filter(Boolean));
        const shouldAskRelationship = uniqueCounties.size <= 1 && personalTypeResolved;
        
        if (shouldAskRelationship) {
            // 1. First ask if it's YOURS
            const mineCount = relationships['mine'] || 0;
            if (mineCount >= 1 && mineCount < personalCandidates.length) {
                questionCandidates.push({
                    type: 'relationship',
                    value: 'mine',
                    text: 'Is it your place?',
                    description: 'Determines if the location belongs to you personally.',
                    split: Math.abs(mineCount - (personalCandidates.length - mineCount)) / personalCandidates.length,
                    count: mineCount
                });
            }

            // 2. Ask richer grouped relationship splitters to narrow personal locations faster.
            const relationshipGroupDefinitions = [
                {
                    value: 'family_relative',
                    text: 'Is it a family member\'s or relative\'s place?',
                    matches: ['family', 'relative'],
                    description: 'Places belonging to family or relatives.'
                },
                {
                    value: 'known_person',
                    text: 'Is it someone you know personally (friend, coworker, neighbor, teacher, coach, or boss)?',
                    matches: ['friend', 'coworker', 'neighbor', 'teacher', 'coach', 'boss'],
                    description: 'Places belonging to people you interact with regularly.'
                },
                {
                    value: 'work_relationship',
                    text: 'Is it work-related (a coworker\'s or boss\'s place)?',
                    matches: ['coworker', 'boss'],
                    description: 'Places tied to workplace relationships.'
                },
                {
                    value: 'school_relationship',
                    text: 'Is it school-related (a teacher\'s or coach\'s place)?',
                    matches: ['teacher', 'coach'],
                    description: 'Places tied to school or training relationships.'
                },
                {
                    value: 'community_relationship',
                    text: 'Is it a friend\'s or neighbor\'s place?',
                    matches: ['friend', 'neighbor'],
                    description: 'Places tied to your local social circle.'
                },
                {
                    value: 'close_circle',
                    text: 'Is it in your close circle (you, family, relative, friend, or neighbor)?',
                    matches: ['mine', 'family', 'relative', 'friend', 'neighbor'],
                    description: 'Places tied to you or your close personal circle.'
                }
            ];

            relationshipGroupDefinitions.forEach(group => {
                const groupCount = group.matches.reduce((sum, rel) => sum + (relationships[rel] || 0), 0);
                if (groupCount >= 1 && groupCount < personalCandidates.length) {
                    questionCandidates.push({
                        type: 'relationship_group',
                        value: group.value,
                        text: group.text,
                        matches: group.matches,
                        description: group.description,
                        split: Math.abs(groupCount - (personalCandidates.length - groupCount)) / personalCandidates.length,
                        count: groupCount
                    });
                }
            });

            // 3. Ask if it's a celebrity
            const celebrityCount = relationships['celebrity'] || 0;
            if (celebrityCount >= 1 && celebrityCount < personalCandidates.length * 0.95) {
                questionCandidates.push({
                    type: 'relationship',
                    value: 'celebrity',
                    text: 'Is it a celebrity\'s place?',
                    description: 'Places belonging to celebrities or public figures.',
                    split: Math.abs(celebrityCount - (personalCandidates.length - celebrityCount)) / personalCandidates.length,
                    count: celebrityCount
                });
            }
            
            // 4. Only ask specific relationship questions if we've narrowed to a small group.
            // Allow 1-count splits here so tiny pools can still be separated (e.g., coach vs teacher vs boss).
            if (personalCandidates.length <= 10 && uniquePersonalCities.size <= 1) {
                for (const [rel, count] of Object.entries(relationships)) {
                    if (['mine', 'celebrity'].includes(rel)) continue; // Already asked above
                    
                    if (count >= 1 && count < personalCandidates.length) {
                        questionCandidates.push({
                            type: 'relationship',
                            value: rel,
                            text: `Is it ${relationshipLabels[rel]} place?`,
                            description: 'Specific relationship clarification for final narrowing.',
                            parent: 'personal_location',
                            split: Math.abs(count - (personalCandidates.length - count)) / personalCandidates.length,
                            count: count
                        });
                    }
                }
            }
        }
    }


    // Track answers to prevent duplicate/redundant questions
    const answeredQuestions = {};
    const answeredValues = {};
    let relationshipConfirmed = false;
    let residenceConfirmed = false;
    let residenceRejected = false;
    let personalLocationConfirmed = false;

    for (const entry of gameState.decisionTree) {
        // Track that this question type was already asked (regardless of answer)
        const questionId = `${entry.type}:${entry.value}`;
        answeredQuestions[questionId] = entry.answer;
        if (entry.value) answeredValues[entry.value] = entry.answer;
        
        // Special handling: k12 name_pattern and school fclass are the same question
        if (entry.type === 'name_pattern' && entry.value === 'k12') {
            answeredQuestions['fclass:school'] = entry.answer; // Also mark school fclass as answered
            answeredQuestions['ambiguous:k12_school'] = entry.answer;
            answeredValues['k12_school'] = entry.answer;
        }
        if (entry.type === 'ambiguous' && entry.value === 'k12_school') {
            answeredQuestions['fclass:school'] = entry.answer;
            answeredQuestions['name_pattern:k12'] = entry.answer;
            answeredValues['k12'] = entry.answer;
        }
        if (entry.type === 'fclass' && entry.value === 'school') {
            answeredQuestions['name_pattern:k12'] = entry.answer; // Also mark k12 name_pattern as answered
            answeredQuestions['ambiguous:k12_school'] = entry.answer;
            answeredValues['k12_school'] = entry.answer;
            answeredValues['k12'] = entry.answer;
        }
        
        // Track if residence was confirmed (eliminates workplace questions)
        if (entry.type === 'ambiguous' && entry.value === 'residence' && entry.answer === 'yes') {
            residenceConfirmed = true;
            answeredQuestions['fclass:personal_residence'] = 'yes';
        }

        if (entry.type === 'fclass_group' && entry.value === 'personal_location' && entry.answer === 'yes') {
            personalLocationConfirmed = true;
        }

        if (
            ((entry.type === 'ambiguous' && entry.value === 'residence') ||
             (entry.type === 'fclass' && entry.value === 'personal_residence')) &&
            entry.answer === 'no'
        ) {
            residenceRejected = true;
            answeredQuestions['fclass:personal_residence'] = 'no';
            if (personalLocationConfirmed) {
                answeredQuestions['fclass:personal_workplace'] = 'yes';
            }
        }
        
        // If any relationship question was answered "yes", block all other relationship questions
        if (entry.type === 'relationship' && entry.answer === 'yes') {
            relationshipConfirmed = true;
        }
        
    }

    const askedIntentKeys = new Set(gameState.decisionTree.map(getQuestionIntentKey).filter(Boolean));
    const schoolLikeCount = candidates.filter(c => c.place.fclass === 'school' || c.place.fclass === 'kindergarten').length;
    const educationFocusMode = candidates.length > 0 && (schoolLikeCount / candidates.length) >= 0.6;
    const countyResolvedNow = new Set(candidates.map(c => c.place.county).filter(Boolean)).size <= 1;

    // Filter out questions we've already asked or whose parent was answered 'no'
    const availableQuestions = questionCandidates.filter(q => {
        const questionKey = `${q.type}:${q.value}`;
        const filterCounties = new Set(candidates.map(c => c.place.county).filter(Boolean));
        const filterCities = new Set(candidates.map(c => c.place.city).filter(Boolean));
        const locationBroad = filterCounties.size > 1 || (filterCounties.size <= 1 && filterCities.size > 2);
        const isNameQuestion = q.type === 'name_pattern' || q.type === 'name_token' || q.type === 'name_prefix';
        const isSchoolSubtypeQuestion =
            q.fclass === 'school' ||
            q.value === 'k12' ||
            q.value === 'elementary' ||
            q.value === 'middle' ||
            q.value === 'high';

        // Keep geo_split disabled generally, but allow explicit late-game split questions.
        if (q.type === 'geo_split' && !q.lateGame) {
            return false;
        }

        // Hard gate: never ask specific county/city until only 2 remain.
        if (q.type === 'county' && filterCounties.size > 2) {
            return false;
        }
        const allowFocusedCityQuestionNow = countyResolvedNow && educationFocusMode && filterCities.size <= 12;
        if (q.type === 'city' && filterCities.size > 2 && !allowFocusedCityQuestionNow) {
            return false;
        }

        // Location-first: while geography is broad, prefer location splits over name details.
        if (locationBroad && isNameQuestion && !(educationFocusMode && isSchoolSubtypeQuestion)) {
            return false;
        }

        // Filter out weak name cuts that only trim tiny amounts.
        if (isNameQuestion && typeof q.count === 'number') {
            const elimination = Math.min(q.count, candidates.length - q.count);
            const eliminationRatio = candidates.length > 0 ? elimination / candidates.length : 0;
            const minElimination = candidates.length <= 12 ? 1 : 4;
            const minRatio = candidates.length <= 12 ? 0.05 : 0.10;
            if (elimination < minElimination || eliminationRatio < minRatio) {
                return false;
            }
        }

        const intentKey = getQuestionIntentKey(q);
        if (intentKey && askedIntentKeys.has(intentKey)) return false;
        
        // Skip if this exact question was already answered
        if (answeredQuestions[questionKey] !== undefined) return false;
        
        // Skip other relationship questions if one was already confirmed
        if (q.type === 'relationship' && relationshipConfirmed) return false;
        
        // Skip residence-type questions if residence already resolved
        if (q.type === 'fclass' && q.value === 'personal_residence' && (residenceConfirmed || residenceRejected)) return false;

        // Enforce broad-before-specific hierarchy for education branches.
        // Ask umbrella split first, then subtype questions.
        if (q.type === 'fclass' && (q.value === 'college' || q.value === 'university')) {
            if (answeredValues['higher_education'] !== 'yes') return false;
        }
        if (q.type === 'fclass' && (q.value === 'school' || q.value === 'kindergarten')) {
            if (answeredValues['k12_school'] !== 'yes' && answeredValues['k12'] !== 'yes') return false;
        }
        
        // Strict parent-child gate: child questions only become available when parent is explicitly YES
        if (q.parent) {
            let parentAnswer = answeredValues[q.parent];
            if (parentAnswer !== 'yes' && q.parent === 'k12') {
                parentAnswer = answeredValues['k12_school'];
            }
            if (parentAnswer !== 'yes' && q.parent === 'k12_school') {
                parentAnswer = answeredValues['k12'];
            }
            if (parentAnswer !== 'yes') return false;
        }
        
        // Skip if already asked (legacy check - should be caught above)
        return !gameState.askedQuestions.includes(questionKey);
    });

    if (availableQuestions.length === 0) {
        // Always try to resolve county/city before any guessing loop.
        if (!locationResolved) {
            const countyCounts = {};
            candidates.forEach(c => {
                if (c.place.county) {
                    countyCounts[c.place.county] = (countyCounts[c.place.county] || 0) + 1;
                }
            });

            const countyEntries = Object.entries(countyCounts);
            if (countyEntries.length > 1) {
                const half = candidates.length / 2;
                const bestCountyEntry = countyEntries
                    .map(([county, count]) => ({ county, count, diff: Math.abs(count - half) }))
                    .filter(entry => entry.count > 0 && entry.count < candidates.length)
                    .sort((a, b) => a.diff - b.diff)[0];

                if (bestCountyEntry) {
                    return {
                        type: 'county',
                        value: bestCountyEntry.county,
                        text: `Is it in ${bestCountyEntry.county} County?`,
                        description: `${bestCountyEntry.county} County is highlighted in <span style="color: #0039A6; font-weight: bold;">blue</span> on the map.`,
                        count: bestCountyEntry.count,
                        information_gain: Math.min(bestCountyEntry.count, candidates.length - bestCountyEntry.count)
                    };
                }
            }

            if (countyResolved) {
                const cityCounts = {};
                candidates.forEach(c => {
                    if (c.place.city) {
                        cityCounts[c.place.city] = (cityCounts[c.place.city] || 0) + 1;
                    }
                });

                const cityEntries = Object.entries(cityCounts);
                if (cityEntries.length > 1) {
                    const half = candidates.length / 2;
                    const bestCityEntry = cityEntries
                        .map(([city, count]) => ({ city, count, diff: Math.abs(count - half) }))
                        .filter(entry => entry.count > 0 && entry.count < candidates.length)
                        .sort((a, b) => a.diff - b.diff)[0];

                    if (bestCityEntry) {
                        return {
                            type: 'city',
                            value: bestCityEntry.city,
                            text: `Is it in ${bestCityEntry.city}?`,
                            description: `${bestCityEntry.city} is highlighted on the map as the target city for this question.`,
                            count: bestCityEntry.count,
                            information_gain: Math.min(bestCityEntry.count, candidates.length - bestCityEntry.count)
                        };
                    }
                }
            }
        }

        const fallbackNameQuestions = generateAdaptiveNameQuestions(candidates, { force: true });
        if (fallbackNameQuestions.length > 0) {
            // Pure BST: score each fallback question by its information gain and use the heap
            fallbackNameQuestions.forEach(q => {
                q.information_gain = typeof q.count === 'number'
                    ? Math.min(q.count, candidates.length - q.count)
                    : 0;
                q.expectedEliminations = q.information_gain;
                q.priorityScore = q.information_gain;
            });

            const fallbackPQ = new QuestionPriorityQueue();
            fallbackNameQuestions.forEach(q => fallbackPQ.enqueue(q));
            const sortedFallback = [];
            while (!fallbackPQ.isEmpty()) sortedFallback.push(fallbackPQ.dequeue());
            fallbackNameQuestions.splice(0, fallbackNameQuestions.length, ...sortedFallback);

            const fallbackBest = fallbackNameQuestions[0];
            return fallbackBest ? fallbackBest : null;
        }

        // No more predefined questions available
        // ONLY guess if we have exactly 1 candidate - otherwise show question limit screen
        if (candidates.length === 1) {
            return {
                type: 'guess',
                place: candidates[0].place
            };
        }
        // If multiple candidates remain but no questions, we've hit a dead end
        // This shouldn't happen with good question design, but if it does, return null
        console.warn(`[Q${gameState.questionCount + 1}·SELECT] No questions available  |  ${candidates.length} candidates remaining`);
        return null;
    }

    // Compute information_gain = min(matches, N - matches) for each question.
    // This is maximized when count = N/2 (perfect 50/50 binary split — BST optimal).
    availableQuestions.forEach(q => {
        q.information_gain = typeof q.count === 'number'
            ? Math.min(q.count, candidates.length - q.count)
            : 0;
    });

    // Budget-aware filtering: as questions remaining shrinks, prefer stronger cuts
    // when such cuts are available.
    let rankableQuestions = availableQuestions;
    if (questionsRemaining <= 12 && candidates.length > 50) {
        const requiredAverageCut = (candidates.length - 1) / Math.max(1, questionsRemaining);
        const minBudgetGain = Math.max(3, Math.floor(requiredAverageCut * 0.2));
        const strongBudgetQuestions = availableQuestions.filter(q => (q.information_gain || 0) >= minBudgetGain);
        if (strongBudgetQuestions.length > 0) {
            rankableQuestions = strongBudgetQuestions;
        }
    }

    // Remove truly duplicate questions (same text)
    const seenQuestionTexts = new Set();
    const dedupedQuestions = rankableQuestions.filter(q => {
        const normalizedText = q.text.toLowerCase().trim();
        if (seenQuestionTexts.has(normalizedText)) return false;
        seenQuestionTexts.add(normalizedText);
        return true;
    });

    // Pure BST selection via max-heap (Huffman-style):
    // Always ask the question whose yes/no split is closest to 50/50.
    // No context multipliers — information_gain alone decides the best question.
    const pq = new QuestionPriorityQueue();
    dedupedQuestions.forEach(q => {
        q.expectedEliminations = q.information_gain;
        q.priorityScore = q.information_gain;
        pq.enqueue(q);
    });

    // Drain heap into ranked order (best split first)
    const rankedQuestions = [];
    while (!pq.isEmpty()) rankedQuestions.push(pq.dequeue());
    dedupedQuestions.splice(0, dedupedQuestions.length, ...rankedQuestions);

    // Pick the question with the largest information_gain
    const bestQuestion = dedupedQuestions[0];

    const n = candidates.length;
    const yesCount = typeof bestQuestion.count === 'number' ? bestQuestion.count : 0;
    const noCount = n - yesCount;
    const yesPct = n > 0 ? (yesCount / n * 100).toFixed(1) : '0.0';
    const noPct = n > 0 ? (noCount / n * 100).toFixed(1) : '0.0';
    const guaranteedCut = typeof bestQuestion.information_gain === 'number' ? bestQuestion.information_gain : Math.min(yesCount, noCount);
    const qLabel = `[Q${gameState.questionCount + 1}·SELECT]`;
    console.log(`${qLabel} "${bestQuestion.text}"  |  split Y:${yesCount} (${yesPct}%) / N:${noCount} (${noPct}%)  |  min-branch gain: ${guaranteedCut}`);

    // Return the best question
    return bestQuestion ? {
        ...bestQuestion
    } : {
        type: 'guess',
        place: candidates[0].place
    };
}

// Dynamically discover useful patterns in place names - makes AI feel intelligent
function discoverNamePatterns(candidates) {
    const questions = [];
    const totalCandidates = candidates.length;
    
    // Skip if too few candidates
    if (totalCandidates < 10) return questions;
    
    // Common meaningful words to look for in place names
    const meaningfulPatterns = [
        // Religious terms
        { word: 'saint', question: 'Does the name start with "Saint"?', prefix: true },
        { word: 'st.', question: 'Does the name start with "St."?', prefix: true },
        { word: 'first', question: 'Does the name include "First"?', prefix: false },
        { word: 'mount', question: 'Does the name include "Mount" or "Mountain"?', prefix: false },
        { word: 'memorial', question: 'Is it a memorial place?', prefix: false },
        { word: 'little', question: 'Does the name start with "Little"?', prefix: true },
        { word: 'big', question: 'Does the name include "Big"?', prefix: false },
        { word: 'branch', question: 'Is it a branch location?', prefix: false },
        { word: 'regional', question: 'Is it a regional facility?', prefix: false },
        { word: 'community', question: 'Is it a community center or facility?', prefix: false }
    ];
    
    // Analyze each pattern
    meaningfulPatterns.forEach(pattern => {
        let matchCount = 0;
        
        candidates.forEach(c => {
            const nameLower = c.place.name.toLowerCase();
            const wordPattern = pattern.word.toLowerCase();
            
            let matches = false;
            if (pattern.prefix) {
                // Check if name starts with this word
                matches = nameLower.startsWith(wordPattern) || nameLower.startsWith(wordPattern.replace('.', ''));
            } else {
                // Check if name contains this word
                matches = nameLower.includes(wordPattern);
            }
            
            if (matches) matchCount++;
        });
        
        // Only add if this pattern affects a meaningful portion of candidates
        // Require meaningful split size to avoid tiny-name cuts
        const percentage = matchCount / totalCandidates;
        if (matchCount >= 8 && percentage >= 0.15 && percentage <= 0.85) {
            const nonMatchCount = totalCandidates - matchCount;
            const split = Math.abs(matchCount - nonMatchCount) / totalCandidates;
            
            questions.push({
                type: 'name_pattern',
                value: `pattern_${pattern.word}`,
                text: pattern.question,
                pattern: pattern.word,
                prefix: pattern.prefix,
                fclass: null, // Applies to all place types
                split: split,
                count: matchCount
            });
        }
    });
    
    // Check for brand/chain names in common place types
    const placeTypes = {
        'supermarket': ['Publix', 'Kroger', 'Walmart', 'Target', 'Aldi', 'Whole Foods', 'Trader Joe', 'Ingles', 'Food Lion', 'Piggly Wiggly'],
        'grocery_store': ['Publix', 'Kroger', 'Walmart', 'Target', 'Aldi', 'Whole Foods', 'Trader Joe', 'Ingles', 'Food Lion', 'Piggly Wiggly'],
        'convenience': ['Circle K', '7-Eleven', 'QuikTrip', 'RaceTrac', 'Shell', 'BP', 'Speedway', 'Wawa'],
        'fast_food': ['McDonald', 'Chick-fil-A', 'Wendy', 'Burger King', 'Taco Bell', 'Subway', 'Arby', 'KFC', 'Popeyes', 'Zaxby', 'Cook Out', 'Bojangles'],
        'restaurant': ['Waffle House', 'Cracker Barrel', 'Applebee', 'Olive Garden', 'Red Lobster', 'Outback', 'Longhorn', 'Buffalo Wild Wings', 'Texas Roadhouse', 'Chili'],
        'cafe': ['Starbucks', 'Dunkin', 'Panera', 'Caribou Coffee', 'Tim Hortons'],
        'fuel': ['Shell', 'BP', 'Chevron', 'Exxon', 'Marathon', 'QuikTrip', 'RaceTrac', 'Circle K'],
        'bank': ['Wells Fargo', 'Bank of America', 'Chase', 'SunTrust', 'BB&T', 'Regions', 'PNC', 'Fifth Third'],
        'pharmacy': ['CVS', 'Walgreens', 'Rite Aid'],
        'hotel': ['Marriott', 'Hilton', 'Holiday Inn', 'Hampton Inn', 'Comfort Inn', 'Best Western', 'La Quinta', 'Hyatt'],
        'mall': ['Town Center', 'Mall of Georgia', 'Perimeter Mall', 'Lenox']
    };
    
    // For each relevant place type, check for brand names
    for (const [fclass, brands] of Object.entries(placeTypes)) {
        const typeCandidates = candidates.filter(c => c.place.fclass === fclass);
        
        if (typeCandidates.length >= 3) {
            // Check each brand
            brands.forEach(brand => {
                const brandMatches = typeCandidates.filter(c => 
                    c.place.name.toLowerCase().includes(brand.toLowerCase())
                );
                
                const matchCount = brandMatches.length;
                const percentage = matchCount / totalCandidates;
                
                // Only ask if it affects candidates meaningfully
                if (matchCount >= 5 && percentage >= 0.10 && percentage <= 0.90) {
                    const nonMatchCount = totalCandidates - matchCount;
                    const split = Math.abs(matchCount - nonMatchCount) / totalCandidates;
                    
                    questions.push({
                        type: 'name_pattern',
                        value: `brand_${brand.toLowerCase().replace(/\s+/g, '_')}`,
                        text: `Is it a ${brand}?`,
                        pattern: brand.toLowerCase(),
                        prefix: false,
                        fclass: fclass,
                        parent: `brand_${fclass}`, // Group brands by category (e.g., brand_supermarket)
                        split: split,
                        count: matchCount
                    });
                }
            });
        }
    }
    
    return questions;
}

function generateAdaptiveNameQuestions(candidates, options = {}) {
    const questions = [];
    const totalCandidates = candidates.length;
    const force = options.force === true;

    if (!force && totalCandidates < 20) return questions;
    if (totalCandidates < 3) return questions;

    const tokenCounts = new Map();
    const STOP_WORDS = new Set([
        'the', 'of', 'in', 'at', 'and', 'for', 'to', 'a', 'an', '&', 'on', 'center',
        'centre', 'campus', 'school', 'college', 'university', 'county', 'city',
        // Personal location template words
        'your', 'house', 'workplace', 'member', 'members', 'family', 'friend', 'friends',
        'relative', 'relatives', 'coworker', 'coworkers', 'coach', 'coachs', 'teacher',
        'teachers', 'boss', 'bosss', 'celebrity', 'celebritys', 'neighbor', 'neighbors',
        'place'
    ]);

    candidates.forEach(c => {
        const tokens = String(c.place.name || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(Boolean);

        const uniqueTokens = new Set(
            tokens.filter(token => token.length >= 3 && !STOP_WORDS.has(token))
        );

        uniqueTokens.forEach(token => {
            tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
        });
    });

    const minCount = force
        ? (totalCandidates <= 12 ? 1 : 4)
        : Math.max(6, Math.floor(totalCandidates * 0.12));
    const maxCount = totalCandidates - minCount;

    const tokenCandidates = Array.from(tokenCounts.entries())
        .filter(([, count]) => count >= minCount && count <= maxCount)
        .map(([token, count]) => ({
            token,
            count,
            elimination: Math.min(count, totalCandidates - count)
        }))
        .sort((a, b) => b.elimination - a.elimination)
        .slice(0, 6);

    tokenCandidates.forEach(({ token, count }) => {
        questions.push({
            type: 'name_token',
            value: token,
            token: token,
            text: `Does the name include "${token}"?`,
            description: 'Narrow by common words in the remaining place names.',
            split: Math.abs(count - (totalCandidates - count)) / totalCandidates,
            count: count
        });
    });

    if (questions.length === 0 && force) {
        const firstWordCounts = new Map();
        const PREFIX_STOP_WORDS = new Set([
            'your', 'a', 'an', 'the', 'my', 'our', 'their', 'his', 'her', 'its'
        ]);

        candidates.forEach(c => {
            const firstWord = String(c.place.name || '')
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, ' ')
                .trim()
                .split(/\s+/)[0];

            if (!firstWord || firstWord.length < 2) return;
            if (PREFIX_STOP_WORDS.has(firstWord)) return;
            firstWordCounts.set(firstWord, (firstWordCounts.get(firstWord) || 0) + 1);
        });

        const prefixMinCount = totalCandidates <= 12 ? 1 : 4;
        const prefixMaxCount = totalCandidates - prefixMinCount;

        const bestPrefix = Array.from(firstWordCounts.entries())
            .filter(([, count]) => count >= prefixMinCount && count <= prefixMaxCount)
            .map(([prefix, count]) => ({
                prefix,
                count,
                elimination: Math.min(count, totalCandidates - count)
            }))
            .sort((a, b) => b.elimination - a.elimination)[0];

        if (bestPrefix) {
            const { prefix, count } = bestPrefix;
            const displayPrefix = prefix
                .split(/\s+/)
                .map(part => part ? part.charAt(0).toUpperCase() + part.slice(1) : part)
                .join(' ');
            questions.push({
                type: 'name_prefix',
                value: prefix,
                prefix: prefix,
                text: `Does the name start with "${displayPrefix}"?`,
                description: 'Fallback split using common starting words in remaining names.',
                split: Math.abs(count - (totalCandidates - count)) / totalCandidates,
                count: count
            });
        }
    }

    return questions;
}

function generateLateGameSplitQuestions(candidates) {
    const questions = [];
    const totalCandidates = candidates.length;

    if (totalCandidates < 3 || totalCandidates > 20) return questions;

    const points = candidates
        .filter(c => Array.isArray(c.place.coordinates) && c.place.coordinates.length >= 2)
        .map(c => ({
            lat: c.place.coordinates[1],
            lng: c.place.coordinates[0]
        }));

    if (points.length < 3) return questions;

    const sortedLats = points.map(p => p.lat).sort((a, b) => a - b);
    const sortedLngs = points.map(p => p.lng).sort((a, b) => a - b);
    const medianLat = sortedLats[Math.floor(sortedLats.length / 2)];
    const medianLng = sortedLngs[Math.floor(sortedLngs.length / 2)];

    const northCount = points.filter(p => p.lat >= medianLat).length;
    const southCount = points.length - northCount;
    if (northCount > 0 && southCount > 0) {
        questions.push({
            type: 'geo_split',
            value: 'late_ns',
            regionValue: 'north',
            axis: 'ns',
            threshold: medianLat,
            text: 'Is it in the northern part of the remaining area?',
            description: 'Late-game location split based on the remaining candidates.',
            split: Math.abs(northCount - southCount) / points.length,
            count: northCount,
            lateGame: true
        });
    }

    const eastCount = points.filter(p => p.lng >= medianLng).length;
    const westCount = points.length - eastCount;
    if (eastCount > 0 && westCount > 0) {
        questions.push({
            type: 'geo_split',
            value: 'late_ew',
            regionValue: 'east',
            axis: 'ew',
            threshold: medianLng,
            text: 'Is it in the eastern part of the remaining area?',
            description: 'Late-game location split based on the remaining candidates.',
            split: Math.abs(eastCount - westCount) / points.length,
            count: eastCount,
            lateGame: true
        });
    }

    return questions;
}

// Generate ambiguous/fun questions that aren't direct
function generateAmbiguousQuestions(candidates) {
    const questions = [];
    const totalCandidates = candidates.length;
    
    // Use the externally defined QUESTION_PATTERNS from questions.js
    QUESTION_PATTERNS.forEach(pattern => {
        let matchCount = 0;
        let matchProb = 0;

        candidates.forEach(c => {
            if (pattern.matches.includes(c.place.fclass)) {
                matchCount++;
                matchProb += c.probability;
            }
        });

        // Residence question is valid even with just 1 match; others need at least 5
        const isResidenceQuestion = pattern.value === 'residence';
        const shouldAdd = isResidenceQuestion
            ? (matchCount > 0 && matchCount < totalCandidates)
            : (matchCount >= 5 && matchCount < totalCandidates - 5);

        if (shouldAdd) {
            const split = Math.abs(matchProb - (1 - matchProb));

            questions.push({
                type: pattern.type,
                value: pattern.value,
                text: pattern.text,
                matches: pattern.matches,
                alsoMatches: pattern.alsoMatches || [],
                split: split,
                count: matchCount,
                description: pattern.description,
                parent: pattern.parent || null
            });
        }
    });
    
    return questions;
}

function formatFclass(fclass) {
    // Format fclass names to be more readable
    const formats = {
        'restaurant': 'restaurant',
        'fast_food': 'fast food place',
        'cafe': 'cafe',
        'bar': 'bar',
        'pub': 'pub',
        'school': 'school',
        'college': 'college',
        'university': 'university',
        'hospital': 'hospital',
        'pharmacy': 'pharmacy',
        'doctors': 'doctor\'s office',
        'dentist': 'dentist',
        'veterinary': 'veterinary clinic',
        'library': 'library',
        'park': 'park',
        'playground': 'playground',
        'sports_centre': 'sports center',
        'stadium': 'stadium',
        'swimming_pool': 'swimming pool',
        'theatre': 'theater',
        'cinema': 'cinema',
        'museum': 'museum',
        'monument': 'monument',
        'artwork': 'artwork',
        'attraction': 'tourist attraction',
        'hotel': 'hotel',
        'motel': 'motel',
        'guest_house': 'guest house',
        'hostel': 'hostel',
        'bank': 'bank',
        'atm': 'ATM',
        'post_office': 'post office',
        'police': 'police station',
        'fire_station': 'fire station',
        'fuel': 'gas station',
        'charging_station': 'charging station',
        'parking': 'parking lot',
        'supermarket': 'supermarket',
        'grocery_store': 'grocery store',
        'grocery': 'grocery store',
        'convenience': 'convenience store',
        'mall': 'shopping mall',
        'clothes': 'clothing store',
        'marketplace': 'marketplace',
        'place_of_worship': 'place of worship',
        'church': 'church',
        'mosque': 'mosque',
        'synagogue': 'synagogue',
        'temple': 'temple',
        'house': 'house',
        'residential': 'residential',
        'apartment': 'apartment',
        'home': 'home',
        'personal_residence': 'personal residence',
        'personal_workplace': 'personal workplace'
    };

    return formats[fclass] || fclass.replace(/_/g, ' ');
}

// ============================================
// ANSWER PROCESSING
// ============================================

// Naive Bayes likelihood table
// P(user gives this answer | candidate IS the match for this question)
// P(user gives this answer | candidate is NOT the match)
// For 'alsoMatches' (incidental match): probability is unchanged (likelihood = 1.0 for both answers)
//
// These values are the learnable parameters of the Naive Bayes model.
// A 'probably' answer reflects ~85% confidence the match is right; 'probably-not' is the mirror.
const ANSWER_LIKELIHOODS = {
    //                 match    nonMatch
    'yes':          { match: 1.0,  nonMatch: 0.0  },
    'no':           { match: 0.0,  nonMatch: 1.0  },
    'probably':     { match: 0.85, nonMatch: 0.15 },
    'probably-not': { match: 0.15, nonMatch: 0.85 },
    'unknown':      { match: 1.0,  nonMatch: 1.0  }   // no update
};

function processAnswer(answer, question) {
    const likeTable = ANSWER_LIKELIHOODS[answer] || ANSWER_LIKELIHOODS['unknown'];

    let matchCount = 0;
    let nonMatchCount = 0;
    // Per-fclass stats for educational Bayes logging.
    // Each fclass can appear in multiple buckets for location/name splits.
    // Shape: fclass -> { match: number, nonMatch: number, incidental: number }
    const fclassStats = new Map();
    
    gameState.candidates.forEach(candidate => {
        let matches = false;
        let alsoApplies = false; // True for places where the question is incidentally true but not primary

        // Check if candidate matches the question
        if (question.type === 'fclass') {
            matches = candidate.place.fclass === question.value;
        } else if (question.type === 'fclass_group') {
            // Check if place fclass is in the group (e.g., college or university, or grocery_shopping)
            matches = question.matches.includes(candidate.place.fclass);
        } else if (question.type === 'city') {
            matches = candidate.place.city === question.value;
        } else if (question.type === 'city_region') {
            // Split cities within a specific county by north/south or east/west
            if (
                candidate.place.county === question.county &&
                candidate.place.city &&
                Array.isArray(candidate.place.coordinates) &&
                candidate.place.coordinates.length >= 2
            ) {
                const [lng, lat] = candidate.place.coordinates;
                if (question.axis === 'ns') {
                    matches = question.regionValue === 'north' ? lat >= question.threshold : lat < question.threshold;
                } else if (question.axis === 'ew') {
                    matches = question.regionValue === 'east' ? lng >= question.threshold : lng < question.threshold;
                }
            }
        } else if (question.type === 'geo_split') {
            if (Array.isArray(candidate.place.coordinates) && candidate.place.coordinates.length >= 2) {
                const [lng, lat] = candidate.place.coordinates;
                if (question.axis === 'ns') {
                    matches = question.regionValue === 'north' ? lat >= question.threshold : lat < question.threshold;
                } else if (question.axis === 'ew') {
                    matches = question.regionValue === 'east' ? lng >= question.threshold : lng < question.threshold;
                }
            }
        } else if (question.type === 'county') {
            matches = candidate.place.county === question.value;
        } else if (question.type === 'ambiguous') {
            // Check if place fclass is in the matches list
            matches = question.matches.includes(candidate.place.fclass);
            alsoApplies = !matches && Array.isArray(question.alsoMatches) && question.alsoMatches.includes(candidate.place.fclass);
        } else if (question.type === 'name_pattern') {
            // Check if place name contains the pattern (e.g., "elementary", "middle", "high")
            const nameLower = candidate.place.name.toLowerCase();
            const patternLower = question.pattern.toLowerCase();
            
            if (question.fclass) {
                // Specific to a place type (e.g., schools)
                // Check if fclass matches first
                if (candidate.place.fclass === question.fclass) {
                    // Special handling for k12 pattern (contains OR logic)
                    if (question.value === 'k12' && patternLower.includes('|')) {
                        // Pattern like 'elementary|middle|high' - check if name contains any
                        const patterns = patternLower.split('|');
                        matches = patterns.some(p => nameLower.includes(p.trim()));
                    } else if (patternLower.includes('|')) {
                        const patterns = patternLower.split('|');
                        matches = patterns.some(p => nameLower.includes(p.trim()));
                    } else {
                        // Simple pattern match
                        matches = nameLower.includes(patternLower);
                    }
                }
            } else {
                // General name pattern (applies to all types)
                if (patternLower.includes('|')) {
                    const patterns = patternLower.split('|');
                    matches = patterns.some(p => nameLower.includes(p.trim()));
                } else if (question.prefix) {
                    matches = nameLower.startsWith(patternLower) || 
                             nameLower.startsWith(patternLower.replace('.', ''));
                } else {
                    matches = nameLower.includes(patternLower);
                }
            }
        } else if (question.type === 'name_token') {
            const nameLower = String(candidate.place.name || '').toLowerCase();
            const tokenLower = String(question.token || question.value || '').toLowerCase();
            matches = tokenLower.length > 0 && nameLower.includes(tokenLower);
        } else if (question.type === 'name_prefix') {
            const firstWord = String(candidate.place.name || '')
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, ' ')
                .trim()
                .split(/\s+/)[0] || '';
            const prefixLower = String(question.prefix || question.value || '').toLowerCase();
            matches = prefixLower.length > 0 && firstWord === prefixLower;
        } else if (question.type === 'relationship') {
            // Check if the personal location matches the relationship
            matches = candidate.place.relationship === question.value;
        } else if (question.type === 'relationship_group') {
            // Check if the personal location's relationship is in the group
            matches = question.matches && question.matches.includes(candidate.place.relationship);
        } else if (question.type === 'region') {
            // Check if the place's county is in the specified region
            if (candidate.place.county && gameState.counties.features) {
                const countyData = gameState.counties.features.find(
                    county => (county.properties?.NAME || county.properties?.name) === candidate.place.county
                );
                if (countyData) {
                    if (question.axis === 'ns') {
                        matches = countyData.region_ns === question.value;
                    } else if (question.axis === 'ew') {
                        matches = countyData.region_ew === question.value;
                    }
                }
            }
        }

        if (matches) matchCount++;
        else nonMatchCount++;

        // Naive Bayes update: P(C | answer) ∝ P(answer | C) × P(C)
        // alsoApplies candidates are incidental matches — likelihood = 1.0 (no update)
        const likelihoods = ANSWER_LIKELIHOODS[answer] || ANSWER_LIKELIHOODS['unknown'];
        const scale = alsoApplies ? 1.0 : (matches ? likelihoods.match : likelihoods.nonMatch);
        candidate.probability = candidate.probability * scale;

        // Track per-fclass result for educational Bayes logging
        const fc = candidate.place.fclass || 'unknown';
        const group = alsoApplies ? 'incidental' : (matches ? 'match' : 'nonMatch');
        if (!fclassStats.has(fc)) {
            fclassStats.set(fc, { match: 0, nonMatch: 0, incidental: 0 });
        }
        fclassStats.get(fc)[group]++;
    });

    // --- Educational Bayes Update Log ---
    // Shows which fclasses were matched, incidentally matched, or penalised, and by what factor.
    // match scale   = P(answer | place IS a match)
    // nonMatch scale = P(answer | place is NOT a match)
    // incidental     = alsoMatches — answer provides no information → scale stays ×1.00
    const scaleLabel = s =>
        s === 1.0 ? 'KEPT (×1.00)' :
        s === 0.0 ? 'ELIMINATED (×0.00)' :
                    `SCALED (×${s.toFixed(2)})`;

    const uLabel = `[Q${gameState.questionCount}·UPDATE]`;
    console.log(`${uLabel} [${answer}] CRITERION "${question.text}"`);
    console.log(`${uLabel} [${answer}] AFFECTED match-set:${matchCount} | non-match-set:${nonMatchCount}`);

    const groups = { match: [], incidental: [], nonMatch: [] };
    fclassStats.forEach((stats, fc) => {
        if (stats.match > 0) groups.match.push(`${fc}(${stats.match})`);
        if (stats.incidental > 0) groups.incidental.push(`${fc}(${stats.incidental})`);
        if (stats.nonMatch > 0) groups.nonMatch.push(`${fc}(${stats.nonMatch})`);
    });

    if (groups.match.length) {
        console.log(`${uLabel} [${answer}] MATCH ${scaleLabel(likeTable.match)} → ${groups.match.join(', ')}`);
    }
    if (groups.incidental.length) {
        console.log(`${uLabel} [${answer}] INCIDENTAL KEPT (×1.00) → ${groups.incidental.join(', ')}`);
    }
    if (groups.nonMatch.length) {
        console.log(`${uLabel} [${answer}] NON-MATCH ${scaleLabel(likeTable.nonMatch)} → ${groups.nonMatch.join(', ')}`);
    }

    // Remove zero-probability candidates
    const beforeFilter = gameState.candidates.length;
    gameState.candidates = gameState.candidates.filter(c => c.probability > 0);

    const eliminated = beforeFilter - gameState.candidates.length;
    const rLabel = `[Q${gameState.questionCount}·RESULT]`;

    console.log(`${rLabel} ${beforeFilter} → ${gameState.candidates.length} candidates (eliminated ${eliminated})`);

    // Normalize probabilities to sum to 1
    const totalProb = gameState.candidates.reduce((sum, c) => sum + c.probability, 0);
    if (totalProb > 0) {
        gameState.candidates.forEach(c => c.probability /= totalProb);
    } else {
        console.warn(`${uLabel} WARNING: total probability = 0 — candidates exhausted`);
    }
    
    // Return statistics about the processing
    return {
        matchCount,
        nonMatchCount
    };
}

// ============================================
// GAME FLOW
// ============================================

function startGame() {
    // Reset game state
    gameState.decisionTree = [];
    gameState.questionCount = 0;
    gameState.gameActive = true;
    gameState.askedQuestions = []; // Clear asked questions for new game
    gameState.locationQuestionsAsked = 0; // Reset location question counter
    gameState.undoStack = []; // Clear undo stack
    gameState.maxQuestions = 20; // Reset question limit
    gameState.previousCandidateCount = 0; // Reset candidate tracking

    // Initialize all places as candidates with equal probability
    // Include personal locations from the start so they can be guessed
    const initialPlaces = gameState.places;
    
    gameState.candidates = initialPlaces.map(place => ({
        place: place,
        probability: 1.0 / initialPlaces.length
    }));
    
    gameState.previousCandidateCount = gameState.candidates.length;

    const prior = (1.0 / gameState.candidates.length).toExponential(3);
    console.log(`[GAME] Started  |  candidates: ${gameState.candidates.length}  |  uniform prior: ${prior}`);

    // Switch to question screen
    switchScreen('questionScreen');

    // Reset stats display
    document.getElementById('questionNum').textContent = `0 / ${gameState.maxQuestions}`;
    document.querySelector('.stats').style.background = '#f5f5f5';

    // Update UI
    updateCandidateCount();
    updateCandidatesList();
    
    // Show change notification if significant reduction
    const previousCount = gameState.previousCandidateCount;
    const currentCount = gameState.candidates.length;
    const reduction = previousCount - currentCount;
    
    if (reduction > 100) {
        showCandidateReduction(reduction, previousCount, currentCount);
    }
    
    gameState.previousCandidateCount = currentCount;
    
    // Map already shows all places from initialization, no need to update yet
    // Map will be updated after first answer when candidates are filtered
    setTimeout(() => {
        gameState.map.invalidateSize();
    }, 100);

    // Ask first question with delay to show initial map state
    setTimeout(() => {
        askNextQuestion();
    }, 150);
}

async function askNextQuestion() {
    const qNum = gameState.questionCount + 1;
    console.log(`\n${'━'.repeat(28)} Q${qNum}  (${gameState.candidates.length} candidates) ${'━'.repeat(28)}\n`);
    const question = generateQuestion();
    
    if (!question) {
        // Hit question limit or no more questions
        if (gameState.questionCount >= gameState.maxQuestions) {
            console.log(`[Q${qNum}·END] Question limit reached (${gameState.maxQuestions}) with ${gameState.candidates.length} candidates remaining`);
            showQuestionLimitScreen();
        } else {
            const topPreview = [...gameState.candidates]
                .sort((a, b) => b.probability - a.probability)
                .slice(0, 3)
                .map(c => `${c.place.name} (${(c.probability * 100).toFixed(1)}%)`)
                .join(' | ');
            console.log(`[Q${qNum}·END] No more discriminative questions with ${gameState.candidates.length} candidates; switching to best-guess mode`);
            if (topPreview) {
                console.log(`[Q${qNum}·END] Top remaining: ${topPreview}`);
            }
            endGame(null);
        }
        return;
    }

    if (question.type === 'guess') {
        console.log(`[GUESS] "${question.place.name}"  (${question.place.fclass})`);
        showGuessScreen(question.place, question.displayName, question.guessGroup);
        return;
    }

    // Store current question before map updates so styling logic can use it
    gameState.currentQuestion = question;

    if (question.type === 'city' || question.type === 'city_region') {
        try {
            await ensureCityBoundariesForCurrentCounty();
        } catch (error) {
            console.warn('[Map] Could not prepare city outlines:', error.message);
        }
    }

    // Highlight regions/counties/city-regions on map based on question type
    if (question.type === 'region') {
        // Show region highlights (blue for queried region, gray for other)
        highlightRegionCounties(question.axis, question.value);
    } else if (question.type === 'county') {
        // Show county highlights (highlight the specific county being asked)
        highlightSpecificCounty(question.value);
    } else if (question.type === 'city_region') {
        // Recolor existing city areas to blue/red for intra-county directional question
        clearRegionHighlights();
        updateMapMarkers();
    } else if (question.type === 'geo_split') {
        // Recolor current markers by dynamic remaining-area split
        clearRegionHighlights();
        updateMapMarkers();
    } else if (question.type === 'city') {
        // Recolor relevant dots only (no city boundary zone overlay)
        clearRegionHighlights();
        updateMapMarkers();
    } else {
        // Clear location highlights for non-location questions
        clearRegionHighlights();
    }

    // Increment question count
    gameState.questionCount++;
    
    // Update question counter display
    const questionsLeft = gameState.maxQuestions - gameState.questionCount;
    document.getElementById('questionNum').textContent = `${gameState.questionCount} / ${gameState.maxQuestions}`;
    
    // Warn if running out of questions (last 5 questions)
    if (questionsLeft <= 5 && questionsLeft > 0) {
        document.querySelector('.stats').style.background = '#ffebee';
    } else if (questionsLeft === 0) {
        document.querySelector('.stats').style.background = '#ffcdd2';
    }
    
    document.getElementById('questionText').textContent = question.text;
    // Show description if present
    const descElem = document.getElementById('questionDescription');
    if (question.description) {
        descElem.innerHTML = question.description;
        descElem.style.opacity = '1';
    } else {
        descElem.innerHTML = '&nbsp;';
        descElem.style.opacity = '0.5';
    }

    // Update candidates list to show which places would match a "Yes" answer
    updateCandidatesList(question);

    // currentQuestion already stored above
}

function handleAnswer(answer) {
    if (!gameState.currentQuestion) return;

    // Special handling for "unknown" - don't count the question
    if (answer === 'unknown') {
        // Record this question as asked so it won't be repeated
        const questionKey = `${gameState.currentQuestion.type}:${gameState.currentQuestion.value}`;
        if (!gameState.askedQuestions.includes(questionKey)) {
            gameState.askedQuestions.push(questionKey);
        }

        // Also record in decision tree for semantic de-duplication logic
        gameState.decisionTree.push({
            question: gameState.currentQuestion.text,
            answer: 'unknown',
            type: gameState.currentQuestion.type,
            value: gameState.currentQuestion.value,
            parent: gameState.currentQuestion.parent || null,
            children: gameState.currentQuestion.children || null,
            information_gain: gameState.currentQuestion.information_gain,
            count: gameState.currentQuestion.count,
            split: gameState.currentQuestion.split,
            candidatesBeforeAnswer: gameState.candidates.length
        });

        // Show loading state
        showLoadingState();
        
        // Decrement question count since this question doesn't count
        gameState.questionCount--;
        
        // Update display
        const questionsLeft = gameState.maxQuestions - gameState.questionCount;
        document.getElementById('questionNum').textContent = `${gameState.questionCount} / ${gameState.maxQuestions}`;
        
        if (questionsLeft <= 5 && questionsLeft > 0) {
            document.querySelector('.stats').style.background = '#ffebee';
        } else {
            document.querySelector('.stats').style.background = '#f5f5f5';
        }
        
        // Skip scoring/probability updates and move to next question
        setTimeout(() => {
            hideLoadingState();
            askNextQuestion();
        }, 300);
        return;
    }

    // Save state for undo (push onto stack for unlimited multi-step undo)
    gameState.undoStack.push({
        candidates: gameState.candidates.map(c => ({...c, place: c.place})),
        decisionTree: gameState.decisionTree.map(d => ({...d})),
        askedQuestions: [...gameState.askedQuestions],
        questionCount: gameState.questionCount,
        locationQuestionsAsked: gameState.locationQuestionsAsked,
        previousCandidateCount: gameState.previousCandidateCount,
        isGuessing: gameState.isGuessing,
        currentQuestion: gameState.currentQuestion ? JSON.parse(JSON.stringify(gameState.currentQuestion)) : null
    });

    // Show loading state
    showLoadingState();

    // Use setTimeout to allow UI to update before heavy processing
    setTimeout(async () => {
        // Record this question as asked
        const questionKey = `${gameState.currentQuestion.type}:${gameState.currentQuestion.value}`;
        if (!gameState.askedQuestions.includes(questionKey)) {
            gameState.askedQuestions.push(questionKey);
        }
        
        // Track location questions
        if (gameState.currentQuestion.type === 'city' || gameState.currentQuestion.type === 'county') {
            gameState.locationQuestionsAsked++;
        }

        // Record decision - save full question metadata for parent-child logic and ML stats
        gameState.decisionTree.push({
            question: gameState.currentQuestion.text,
            answer: answer,
            type: gameState.currentQuestion.type,
            value: gameState.currentQuestion.value,
            parent: gameState.currentQuestion.parent || null,
            children: gameState.currentQuestion.children || null,
            // ML stats for explanation
            information_gain: gameState.currentQuestion.information_gain,
            count: gameState.currentQuestion.count,
            split: gameState.currentQuestion.split,
            candidatesBeforeAnswer: gameState.candidates.length
        });

        // Add personal locations ONLY after explicit confirmation that it's a personal location.
        const isPersonalLocationConfirmation =
            gameState.currentQuestion.type === 'fclass_group' &&
            gameState.currentQuestion.value === 'personal_location' &&
            answer === 'yes';

        if (isPersonalLocationConfirmation) {
            // Add personal locations that match current candidate counties/cities BEFORE processing answer
            const currentCounties = new Set(gameState.candidates.map(c => c.place.county).filter(Boolean));
            const currentCities = new Set(gameState.candidates.map(c => c.place.city).filter(Boolean));
            
            const personalPlaces = gameState.places.filter(place => 
                (place.fclass === 'personal_residence' || place.fclass === 'personal_workplace') &&
                (currentCounties.has(place.county) || currentCities.has(place.city))
            );
            
            // Only add if not already there
            const currentPlaceIds = new Set(gameState.candidates.map(c => c.place.name + c.place.county));
            const newPersonalPlaces = personalPlaces.filter(p => 
                !currentPlaceIds.has(p.name + p.county)
            );
            
            if (newPersonalPlaces.length > 0) {
                
                // Add personal locations with appropriate probability
                const avgProbability = gameState.candidates.length > 0 
                    ? gameState.candidates.reduce((sum, c) => sum + c.probability, 0) / gameState.candidates.length
                    : 0.001;
                
                newPersonalPlaces.forEach(place => {
                    gameState.candidates.push({
                        place: place,
                        probability: avgProbability * 0.5  // Start with moderate probability
                    });
                });
                
                // Normalize probabilities
                const totalProb = gameState.candidates.reduce((sum, c) => sum + c.probability, 0);
                if (totalProb > 0) {
                    gameState.candidates.forEach(c => c.probability /= totalProb);
                }
            }
        }

        // Process answer to update candidates
        const answerStats = processAnswer(answer, gameState.currentQuestion);

        try {
            await ensureCityBoundariesForCurrentCounty();
        } catch (error) {
            console.warn('[Map] Could not prepare city outlines after narrowing:', error.message);
        }
        
        // Update the last decision tree entry with after-answer statistics
        const lastStep = gameState.decisionTree[gameState.decisionTree.length - 1];
        lastStep.candidatesAfter = gameState.candidates.length;
        lastStep.candidatesRemoved = lastStep.candidatesBeforeAnswer - lastStep.candidatesAfter;
        lastStep.matchCount = answerStats.matchCount;
        lastStep.nonMatchCount = answerStats.nonMatchCount;

        // If we just confirmed a county, zoom to it
        if (gameState.currentQuestion.type === 'county' && answer === 'yes') {
            zoomToCounty(gameState.currentQuestion.value);
        }

        // Update UI
        updateCandidateCount();
        updateCandidatesList();
        
        // Update map (this will refresh county highlights based on remaining candidates)
        updateMapMarkers();

        // Hide loading and ask next question
        setTimeout(() => {
            hideLoadingState();
            askNextQuestion();
        }, 300);
    }, 50);
}

function updateCandidateCount() {
    const count = gameState.candidates.length;
    const countElem = document.getElementById('candidateCount');
    const oldCount = parseInt(countElem.textContent) || count;
    
    countElem.textContent = `${count} possible place${count !== 1 ? 's' : ''}`;
    
    // Add visual feedback for changes
    if (count < oldCount) {
        countElem.style.animation = 'none';
        setTimeout(() => {
            countElem.style.animation = 'flash 0.5s';
        }, 10);
    }
}

function endGame(guessedPlace) {
    gameState.gameActive = false;

    if (!guessedPlace && gameState.candidates.length > 0) {
        // Pick highest probability candidate
        gameState.candidates.sort((a, b) => b.probability - a.probability);
        guessedPlace = gameState.candidates[0].place;
        const bestProb = gameState.candidates[0]?.probability || 0;
        console.log(`[GAME·END] Selecting best guess from remaining candidates: "${guessedPlace.name}" (${(bestProb * 100).toFixed(1)}%)`);
    }

    if (!guessedPlace) {
        console.warn('[GAME·END] No candidates available to guess; restarting game');
        alert('Something went wrong - no places to guess!');
        restartGame();
        return;
    }

    // Instead of going directly to result screen, show guess screen
    // so user can tell us if we're wrong
    showGuessScreen(guessedPlace);
}

function showGuessScreen(place, displayName = null, guessGroup = null) {
    gameState.isGuessing = true;
    gameState.currentGuess = place;
    gameState.currentGuessLabel = displayName || place.name;
    gameState.currentGuessGroup = guessGroup || null;

    // Remove any prior question-region overlays before showing final guess focus
    clearRegionHighlights();

    // Display the guess
    document.getElementById('guessPlace').textContent = gameState.currentGuessLabel;
    
    let details = `Type: ${formatFclass(place.fclass)}`;
    if (place.city) details += `\nCity: ${place.city}`;
    if (place.county) details += `\nCounty: ${place.county}`;
    document.getElementById('guessDetails').textContent = details;

    // Highlight this place on the map
    highlightGuessPlace(place);

    // Switch to guess screen
    switchScreen('guessScreen');
}

function showSuccessScreen(place) {
    // Remove any prior question-region overlays before final reveal
    clearRegionHighlights();

    // Display success result
    const resultTitle = `I got it in ${gameState.questionCount}/${gameState.maxQuestions} guesses!`;
    
    document.getElementById('resultTitle').textContent = resultTitle;
    document.getElementById('guessedPlace').textContent = gameState.currentGuessLabel || place.name;
    
    let details = `Type: ${formatFclass(place.fclass)}`;
    if (place.city) details += `\nCity: ${place.city}`;
    if (place.county) details += `\nCounty: ${place.county}`;
    document.getElementById('guessedDetails').textContent = details;

    // Highlight on map
    highlightFinalPlace(place);

    // Switch to result screen
    switchScreen('resultScreen');
}

function handleGuessCorrect() {
    // User confirmed the guess is correct
    gameState.questionCount++; // Guessing counts as a question
    gameState.isGuessing = false;
    console.log(`[GAME·END] Guess confirmed correct in ${gameState.questionCount}/${gameState.maxQuestions}: "${gameState.currentGuessLabel || gameState.currentGuess.name}"`);
    
    // Add guess to decision tree
    gameState.decisionTree.push({
        question: `Is it ${gameState.currentGuessLabel || gameState.currentGuess.name}?`,
        answer: 'yes',
        type: 'guess'
    });
    
    // Show success result screen
    showSuccessScreen(gameState.currentGuess);
}

function handleGuessWrong() {
    // User said the guess is wrong
    gameState.questionCount++; // Guessing counts as a question
    gameState.isGuessing = false;
    console.log(`[GAME·END] Guess rejected at ${gameState.questionCount}/${gameState.maxQuestions}: "${gameState.currentGuessLabel || gameState.currentGuess.name}"`);
    
    // Add guess to decision tree
    gameState.decisionTree.push({
        question: `Is it ${gameState.currentGuessLabel || gameState.currentGuess.name}?`,
        answer: 'no',
        type: 'guess'
    });
    
    // Remove this guess from candidates
    // If grouped guess mode was used, remove the whole grouped bucket (type + city/county)
    if (gameState.currentGuessGroup) {
        gameState.candidates = gameState.candidates.filter(c => {
            const locationKey = c.place.city || c.place.county;
            return !(c.place.fclass === gameState.currentGuessGroup.fclass && locationKey === gameState.currentGuessGroup.locationKey);
        });
    } else {
        gameState.candidates = gameState.candidates.filter(
            c => c.place !== gameState.currentGuess
        );
    }
    
    // Normalize probabilities after removing a candidate
    if (gameState.candidates.length > 0) {
        const totalProb = gameState.candidates.reduce((sum, c) => sum + c.probability, 0);
        if (totalProb > 0) {
            gameState.candidates.forEach(c => {
                c.probability = c.probability / totalProb;
            });
        }
    }
    
    // Check if we're out of candidates first
    if (gameState.candidates.length === 0) {
        console.warn('[GAME·END] All candidates exhausted after rejected guess');
        alert("I'm out of ideas! You win this round!");
        restartGame();
        return;
    }
    
    // Check if we're out of questions
    if (gameState.questionCount >= gameState.maxQuestions) {
        // Show question limit screen with continue option
        switchScreen('questionScreen');
        showQuestionLimitScreen();
        return;
    }
    
    // Update map and continue asking
    updateCandidateCount();
    updateCandidatesList();
    updateMapMarkers();
    
    // Go back to question screen and continue
    switchScreen('questionScreen');
    askNextQuestion();
}

function undoLastAnswer() {
    if (!gameState.undoStack || gameState.undoStack.length === 0) {
        alert('No previous answer to undo!');
        return;
    }
    
    // Pop the most recent snapshot off the stack
    const previousState = gameState.undoStack.pop();
    
    // Restore previous state
    gameState.candidates = previousState.candidates;
    gameState.decisionTree = previousState.decisionTree;
    gameState.askedQuestions = previousState.askedQuestions;
    gameState.questionCount = previousState.questionCount;
    gameState.locationQuestionsAsked = previousState.locationQuestionsAsked;
    gameState.previousCandidateCount = previousState.previousCandidateCount;
    gameState.isGuessing = previousState.isGuessing;
    gameState.currentQuestion = previousState.currentQuestion;
    
    // Update UI
    const questionsLeft = gameState.maxQuestions - gameState.questionCount;
    document.getElementById('questionNum').textContent = `${gameState.questionCount} / ${gameState.maxQuestions}`;
    
    if (questionsLeft <= 5) {
        document.querySelector('.stats').style.background = '#ffebee';
    } else {
        document.querySelector('.stats').style.background = '#f5f5f5';
    }
    
    updateCandidateCount();
    updateCandidatesList();
    updateMapMarkers();
    
    // Clear any region highlights first
    clearRegionHighlights();
    
    // If we're undoing back to a location question, re-highlight it
    if (gameState.currentQuestion.type === 'region') {
        highlightRegionCounties(gameState.currentQuestion.axis, gameState.currentQuestion.value);
    } else if (gameState.currentQuestion.type === 'county') {
        highlightSpecificCounty(gameState.currentQuestion.value);
    } else if (gameState.currentQuestion.type === 'city') {
        highlightCityBoundary(gameState.currentQuestion.value);
    }
    
    // Re-display the question text and description
    document.getElementById('questionText').textContent = gameState.currentQuestion.text;
    const descElem = document.getElementById('questionDescription');
    if (gameState.currentQuestion.description) {
        descElem.innerHTML = gameState.currentQuestion.description;
        descElem.style.opacity = '1';
    } else {
        descElem.innerHTML = '&nbsp;';
        descElem.style.opacity = '0.5';
    }

    // Restore question-match view for the restored question
    updateCandidatesList(gameState.currentQuestion);
}

function restartGame() {
    switchScreen('startScreen');

    // Reset game state so old round data never leaks into the next round
    gameState.candidates = [];
    gameState.decisionTree = [];
    gameState.questionCount = 0;
    gameState.askedQuestions = [];
    gameState.isGuessing = false;
    gameState.locationQuestionsAsked = 0;
    gameState.undoStack = [];
    gameState.currentQuestion = null;
    gameState.currentGuess = null;
    gameState.currentGuessLabel = null;
    gameState.currentGuessGroup = null;
    gameState.maxQuestions = 20;
    gameState.previousCandidateCount = 0;
    
    // Clear any region highlights
    clearRegionHighlights();

    // Clear candidate list UI from previous round
    const listElem = document.getElementById('candidatesList');
    const panelElem = document.querySelector('.candidates-list-panel');
    if (listElem) {
        listElem.innerHTML = '';
        listElem.classList.remove('candidates-list-few-bg');
    }
    if (panelElem) {
        panelElem.style.display = 'none';
    }

    // Reset question/counter display
    const questionElem = document.getElementById('questionText');
    if (questionElem) questionElem.textContent = 'Think of a place in Georgia...';
    const questionNumElem = document.getElementById('questionNum');
    if (questionNumElem) questionNumElem.textContent = `0 / ${gameState.maxQuestions}`;
    const candidateCountElem = document.getElementById('candidateCount');
    if (candidateCountElem) candidateCountElem.textContent = '0 possible places';
    
    // Show all places on map again
    showAllPlacesOnMap();
    refreshLocationFinder();
    
    // Reset stats styling
    document.querySelector('.stats').style.background = '#f5f5f5';
}

function showCandidateReduction(reduction, previousCount, currentCount) {
    // Show temporary notification about candidate reduction
    const notification = document.createElement('div');
    notification.className = 'candidate-notification';
    notification.innerHTML = `
        <strong>Narrowed down!</strong><br>
        ${previousCount} → ${currentCount} places<br>
        <span style="color: #CC0000;">-${reduction} eliminated</span>
    `;
    
    document.querySelector('.game-panel').appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 500);
    }, 2500);
}

function showQuestionLimitScreen() {
    // Show screen when question limit is reached
    document.getElementById('questionText').innerHTML = `
        <div style="text-align: center;">
            <h3 style="color: #CC0000; margin-bottom: 15px;">Out of Questions!</h3>
            <p style="margin-bottom: 20px;">I've used all ${gameState.maxQuestions} questions. What would you like to do?</p>
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button id="continueBtn" class="btn btn-primary" style="font-size: 1em;">Continue Asking Questions</button>
                <button id="giveUpBtn" class="btn btn-secondary" style="font-size: 1em;">Give Up & See Best Guess</button>
                <button id="restartFromLimitBtn" class="btn btn-secondary" style="font-size: 1em;">Restart Game</button>
            </div>
        </div>
    `;
    
    // Disable answer buttons
    document.querySelectorAll('.answer-buttons .btn').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.3';
    });
    
    // Add event listeners
    document.getElementById('continueBtn').addEventListener('click', () => {
        // Remove question limit and continue
        gameState.maxQuestions += 100; // Add 100 more questions
        document.getElementById('questionNum').textContent = `${gameState.questionCount} / ∞`;
        
        // Re-enable answer buttons
        document.querySelectorAll('.answer-buttons .btn').forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
        });
        
        // Ask next question
        askNextQuestion();
    });
    
    document.getElementById('giveUpBtn').addEventListener('click', () => {
        // Make best guess from remaining candidates
        gameState.candidates.sort((a, b) => b.probability - a.probability);
        if (gameState.candidates.length > 0) {
            showGuessScreen(gameState.candidates[0].place);
        } else {
            alert("No candidates remaining!");
            restartGame();
        }
    });
    
    document.getElementById('restartFromLimitBtn').addEventListener('click', () => {
        restartGame();
    });
}

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ============================================
// DECISION TREE DISPLAY
// ============================================

function showDecisionTree() {
    const treeElem = document.getElementById('decisionTree');
    treeElem.innerHTML = '';

    if (gameState.decisionTree.length === 0) {
        treeElem.innerHTML = '<p>No questions asked yet.</p>';
    } else {
        gameState.decisionTree.forEach((step, index) => {
            const stepDiv = document.createElement('div');
            stepDiv.className = 'decision-step';
            
            const prefix = step.type === 'guess' ? '🎯 Guess' : `Question ${index + 1}`;
            
            // Build decision summary display based on answer type
            let impactHtml = '';
            if (step.type !== 'guess' && step.candidatesBeforeAnswer !== undefined && step.candidatesAfter !== undefined) {
                const before = step.candidatesBeforeAnswer;
                const removed = step.candidatesRemoved;
                const after = step.candidatesAfter;
                const impactPercent = ((removed / before) * 100).toFixed(1);
                const matchingCount = step.matchCount || 0;
                
                // Show different display for probability adjustments vs eliminations
                if (step.answer === 'probably' || step.answer === 'probably-not') {
                    const likeTable = ANSWER_LIKELIHOODS[step.answer] || ANSWER_LIKELIHOODS['unknown'];
                    const matchWeight = `×${likeTable.match.toFixed(2)}`;
                    const nonMatchWeight = `×${likeTable.nonMatch.toFixed(2)}`;
                    
                    // Determine category name based on question type
                    let categoryName = '';
                    if (step.type === 'fclass') {
                        categoryName = formatFclass(step.value);
                    } else if (step.type === 'fclass_group') {
                        // Use the value if available, otherwise extract from question
                        categoryName = step.value || step.question.replace(/^Is it /i, '').replace(/\?$/, '');
                    } else if (step.type === 'city') {
                        categoryName = `City: ${step.value}`;
                    } else if (step.type === 'county') {
                        categoryName = `${step.value} County`;
                    } else if (step.type === 'region') {
                        const regionLabels = {
                            'north': 'Northern Georgia',
                            'south': 'Southern Georgia',
                            'east': 'Eastern Georgia',
                            'west': 'Western Georgia'
                        };
                        categoryName = regionLabels[step.value] || step.value;
                    } else if (step.type === 'name_pattern') {
                        categoryName = `Name: ${step.value}`;
                    } else if (step.type === 'relationship') {
                        const relationshipLabels = {
                            'mine': 'Your place',
                            'family': 'Family member',
                            'friend': 'Friend',
                            'relative': 'Relative',
                            'coworker': 'Coworker',
                            'coach': 'Coach',
                            'teacher': 'Teacher',
                            'boss': 'Boss',
                            'celebrity': 'Celebrity',
                            'neighbor': 'Neighbor'
                        };
                        categoryName = relationshipLabels[step.value] || step.value;
                    } else if (step.type === 'ambiguous') {
                        // Use the value field which contains the category (like "shopping", "food")
                        categoryName = step.value ? step.value.charAt(0).toUpperCase() + step.value.slice(1) : 'Multiple types';
                    } else {
                        // Fallback - use value if available
                        categoryName = step.value || 'Multiple types';
                    }
                    
                    impactHtml = `
                        <div style="display: flex; flex-direction: column; padding: 8px 12px; background: #f8f9fa; border-radius: 6px; font-family: monospace; font-size: 0.9em; min-width: 160px;">
                            <div style="position: relative;">
                                <div style="color: #555; font-weight: bold; margin-bottom: 6px; font-size: 0.85em; text-align: center;">Weight Adjustment</div>
                                <div style="color: #0071CE; font-size: 0.8em; margin-bottom: 4px; text-align: center; font-style: italic;">${categoryName}</div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                                    <span style="color: #555; font-size: 0.85em;">Match:</span>
                                    <span style="color: #2E7D32; font-weight: bold;">${matchWeight}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                                    <span style="color: #555; font-size: 0.85em;">Non-match:</span>
                                    <span style="color: #C62828; font-weight: bold;">${nonMatchWeight}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="color: #555; font-size: 0.85em;">Matched:</span>
                                    <span style="color: #555; font-weight: bold;">${matchingCount}</span>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    // Show elimination equation
                    impactHtml = `
                        <div style="display: flex; flex-direction: column; padding: 8px 12px; background: #f8f9fa; border-radius: 6px; font-family: monospace; font-size: 0.9em; min-width: 140px;">
                            <div style="position: relative;">
                                <div style="color: #555; font-weight: bold; margin-bottom: 2px; margin-left: 12px;">${before}</div>
                                <div style="color: #555; font-weight: bold; margin-bottom: 2px; display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <span style="position: absolute; left: 0;">−</span>
                                        <span style="margin-left: 12px;">${removed}</span>
                                    </div>
                                    <span style="color: #0071CE; font-weight: bold; margin-left: 16px;">| ${impactPercent}%</span>
                                </div>
                                <div style="border-top: 2px solid #ddd; margin: 2px 0;"></div>
                                <div style="color: #555; font-weight: bold; margin-top: 2px; margin-left: 12px;">${after}</div>
                            </div>
                        </div>
                    `;
                }
            }
            
            let html = `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 15px;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 5px;">
                            <strong style="font-size: 1.1em; color: #0071CE;">${prefix}:</strong>
                            <span class="answer ${step.answer}" style="font-size: 0.9em;">${formatAnswer(step.answer)}</span>
                        </div>
                        <div style="font-size: 1.05em;">${step.question}</div>
                    </div>
                    ${impactHtml}
                </div>
            `;
            
            stepDiv.innerHTML = html;
            treeElem.appendChild(stepDiv);
        });
    }

    document.getElementById('treeModal').classList.add('active');
}

function formatAnswer(answer) {
    const formats = {
        'yes': 'Yes',
        'no': 'No',
        'probably': 'Probably',
        'probably-not': 'Probably Not',
        'unknown': 'Don\'t Know'
    };
    return formats[answer] || answer;
}

function closeModal() {
    document.getElementById('treeModal').classList.remove('active');
}

function showLoadingState() {
    const questionBox = document.querySelector('.question-box');
    questionBox.classList.add('loading');
    document.getElementById('questionText').innerHTML = `
        <div class="thinking-animation">
            <p class="thinking-text">Thinking<span class="thinking-dot">.</span><span class="thinking-dot">.</span><span class="thinking-dot">.</span></p>
        </div>
    `;
    
    // Hide question description during loading
    const descElem = document.getElementById('questionDescription');
    if (descElem) {
        descElem.innerHTML = '&nbsp;';
        descElem.style.opacity = '0';
    }
    
    // Disable answer buttons
    document.querySelectorAll('.answer-buttons .btn').forEach(btn => {
        btn.disabled = true;
    });
}

function hideLoadingState() {
    const questionBox = document.querySelector('.question-box');
    questionBox.classList.remove('loading');
    
    // Re-enable answer buttons
    document.querySelectorAll('.answer-buttons .btn').forEach(btn => {
        btn.disabled = false;
    });
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    initializeMap();
    initializeMapOverlayToggles();
    
    // Show loading message
    document.getElementById('startScreen').innerHTML = `
        <h2>Loading Data...</h2>
        <p>Please wait while we load the Georgia places database.</p>
        <div style="margin: 20px 0;">
            <div style="width: 200px; height: 4px; background: #e0e0e0; border-radius: 2px; overflow: hidden;">
                <div style="width: 100%; height: 100%; background: #0071CE; animation: loading 1.5s ease-in-out infinite;">
                    <style>
                        @keyframes loading {
                            0%, 100% { transform: translateX(-100%); }
                            50% { transform: translateX(100%); }
                        }
                    </style>
                </div>
            </div>
        </div>
    `;

    // Let the browser paint map tiles + loading UI before heavy data work begins.
    await yieldToMainThread();
    await yieldToMainThread();
    
    // Load data
    const loaded = await loadData();
    if (!loaded) return;
    
    // Restore start screen immediately (do not block on full marker render)
    document.getElementById('startScreen').innerHTML = `
        <h2>Welcome to Geonator!</h2>
        <p>Think of any place in Georgia (restaurant, park, school, landmark, etc.)</p>
        <p>I'll ask you questions to guess what you're thinking of.</p>
        <button id="startBtn" class="btn btn-primary btn-large">Start Game</button>
    `;

    // Paint map progressively in the background
    requestAnimationFrame(() => {
        showAllPlacesOnMap();
        refreshLocationFinder();
    });

    // Start button
    document.getElementById('startBtn').addEventListener('click', startGame);

    // Map finder controls
    const finderCounty = document.getElementById('finderCounty');
    const finderCity = document.getElementById('finderCity');
    const finderPlaceInput = document.getElementById('finderPlaceInput');
    const finderGoBtn = document.getElementById('finderGoBtn');
    const finderResetBtn = document.getElementById('finderResetBtn');
    const finderPrevBtn = document.getElementById('finderPrevBtn');
    const finderNextBtn = document.getElementById('finderNextBtn');

    if (finderCounty) {
        finderCounty.addEventListener('change', () => {
            refreshLocationFinder();
        });
    }
    if (finderCity) {
        finderCity.addEventListener('change', () => {
            refreshLocationFinder();
        });
    }
    if (finderPlaceInput) {
        finderPlaceInput.addEventListener('change', () => {
            handleLocationFinderSearch();
        });
        finderPlaceInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleLocationFinderSearch();
            }
        });
    }
    if (finderGoBtn) {
        finderGoBtn.addEventListener('click', handleLocationFinderSearch);
    }
    if (finderResetBtn) {
        finderResetBtn.addEventListener('click', resetLocationFinder);
    }
    if (finderPrevBtn) {
        finderPrevBtn.addEventListener('click', () => navigateFinderMatch(-1));
    }
    if (finderNextBtn) {
        finderNextBtn.addEventListener('click', () => navigateFinderMatch(1));
    }

    // Answer buttons
    document.querySelectorAll('.answer-buttons .btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const answer = e.target.dataset.answer;
            handleAnswer(answer);
        });
    });

    // Guess buttons
    document.getElementById('guessCorrectBtn').addEventListener('click', handleGuessCorrect);
    document.getElementById('guessWrongBtn').addEventListener('click', handleGuessWrong);

    // Restart button
    document.getElementById('restartBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to restart?')) {
            restartGame();
        }
    });
    
    // Undo button
    document.getElementById('undoBtn').addEventListener('click', undoLastAnswer);
    
    // View tree button (during game)
    document.getElementById('viewTreeBtn').addEventListener('click', showDecisionTree);

    // View tree buttons (only on result/guess screens)
    document.getElementById('viewFinalTreeBtn').addEventListener('click', showDecisionTree);

    // Play again button
    document.getElementById('playAgainBtn').addEventListener('click', restartGame);

    // Modal close
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    
    // Close modal when clicking outside
    document.getElementById('treeModal').addEventListener('click', (e) => {
        if (e.target.id === 'treeModal') {
            closeModal();
        }
    });
});
