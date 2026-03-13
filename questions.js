// =============================================================================
// GEONATOR — QUESTION DEFINITIONS
// =============================================================================
// All ambiguous/category questions used by generateAmbiguousQuestions().
// Each entry is matched against a candidate's `fclass` value.
//
// Fields:
//   text        — Question shown to the player
//   value       — Unique key for de-duplication and decision-tree logging
//   type        — Always 'ambiguous' here; engine handles scoring
//   matches     — fclass values that are a PRIMARY match (yes → keep, no → remove)
//   alsoMatches — fclass values that are INCIDENTAL matches (yes → keep, no → keep)
//                 Use alsoMatches when the activity can happen there but isn't the
//                 primary purpose (e.g. you can eat at a school but it's not a restaurant)
//   parent      — Optional: value of a parent question; child is skipped if parent = 'no'
//   description — Displayed below the question as a map hint
//
// FCLASS REFERENCE (all types present in places_combined.json + personal):
//   Food & Drink:     restaurant, fast_food, cafe, bar, pub, biergarten, food_court, bakery
//   Shopping:         supermarket, convenience, grocery_store, grocery, mall, clothes,
//                     department_store, bookshop, computer_shop, mobile_phone_shop, shoe_shop,
//                     sports_shop, furniture_shop, gift_shop, florist, toy_shop, jeweller,
//                     stationery, newsagent, butcher, greengrocer, video_shop, kiosk,
//                     chemist, market_place, bicycle_shop, car_dealership, optician
//   Services:         hairdresser, beauty_shop, laundry, car_wash, car_rental, bicycle_rental,
//                     car_sharing, travel_agent, car_parts_shop
//   Healthcare:       hospital, clinic, doctors, dentist, pharmacy, veterinary, nursing_home,
//                     optician
//   Education:        school, kindergarten, college, university, library, driving_school
//   Recreation:       park, dog_park, playground, golf_course, sports_centre, pitch,
//                     swimming_pool, stadium, zoo, theme_park, ice_rink, sports_hall
//   Finance:          bank, atm, bureau_de_change
//   Accommodation:    hotel, motel, hostel, guesthouse, guest_house, chalet,
//                     camp_site, caravan_site, alpine_hut
//   Fuel & Transport: fuel, charging_station, parking, car_wash, bus_station,
//                     ferry_terminal, airport, train_station, bicycle_parking
//   Government:       police, fire_station, courthouse, post_office, town_hall,
//                     embassy, prison, public_building, military
//   Religion:         church, place_of_worship, mosque, synagogue, temple, chapel,
//                     monastery, shrine, wayside_cross, wayside_shrine
//   Culture & Arts:   museum, theatre, cinema, arts_centre, nightclub, community_centre,
//                     social_facility, art_gallery
//   Historic/Outdoor: castle, ruins, fort, battlefield, memorial, monument, viewpoint,
//                     observation_tower, lighthouse, tower, artwork, attraction
//   Nature/Infra:     farm, island, water_tower, water_works, wastewater_plant, comms_tower
//   Small Amenities:  bench, drinking_water, post_box, telephone, toilet, vending_machine,
//                     waste_basket, recycling, recycling_glass, recycling_paper,
//                     recycling_metal, recycling_clothes
//   Settlements:      city, town, village, suburb, county, locality
//   Graveyards:       graveyard
//   Personal:         personal_residence, personal_workplace
// =============================================================================

const QUESTION_PATTERNS = [

    // -------------------------------------------------------------------------
    // TIER 1 — BROADEST SPLITS (indoor/outdoor, personal, settlement)
    // -------------------------------------------------------------------------

    {
        type: 'ambiguous',
        text: "Is it mainly indoors?",
        value: "indoors",
        matches: [
            // Food & Drink
            'restaurant','fast_food','cafe','bar','pub','biergarten','food_court','bakery',
            // Shopping
            'supermarket','convenience','grocery_store','grocery','mall','clothes','department_store',
            'bookshop','computer_shop','mobile_phone_shop','shoe_shop','sports_shop','furniture_shop',
            'gift_shop','florist','toy_shop','jeweller','stationery','newsagent','butcher',
            'greengrocer','video_shop','kiosk','chemist','market_place','bicycle_shop',
            'car_dealership','optician',
            // Services
            'hairdresser','beauty_shop','laundry','car_wash','car_rental','bicycle_rental',
            'car_sharing','travel_agent',
            // Healthcare
            'hospital','clinic','doctors','dentist','pharmacy','veterinary','nursing_home',
            // Education
            'school','kindergarten','college','university','library','driving_school',
            // Finance
            'bank','atm','bureau_de_change',
            // Accommodation
            'hotel','motel','hostel','guesthouse','guest_house',
            // Government
            'police','fire_station','courthouse','post_office','town_hall','embassy','prison',
            'public_building',
            // Culture & Arts
            'museum','theatre','cinema','arts_centre','nightclub','community_centre',
            'social_facility','art_gallery',
            // Sports (indoor variety)
            'sports_centre','sports_hall','swimming_pool','ice_rink',
            // Religion
            'church','place_of_worship','mosque','synagogue','temple','chapel','monastery',
            // Personal
            'personal_residence','personal_workplace',
        ],
        // Gas/EV stations have an indoor convenience store but are primarily outdoor;
        // treat them as incidental so a 'yes' or 'no' answer doesn't eliminate them
        alsoMatches: ['fuel','charging_station'],
        description: "Places where most activity happens inside a building."
    },

    {
        type: 'ambiguous',
        text: "Is it a private personal location (someone's home or workplace) that usually would not appear as a public map place?",
        value: "personal_location_broad",
        matches: [
            'personal_residence','personal_workplace'
        ],
        description: "Private residences/workplaces tied to specific people, rather than typical public landmarks or businesses shown on maps."
    },

    {
        type: 'ambiguous',
        text: "Is it a residence — somewhere someone lives?",
        value: "residence",
        parent: 'indoors',
        matches: ['personal_residence'],
        description: "Places where someone lives, like a house or apartment."
    },

    {
        type: 'ambiguous',
        text: "Is it an entire city, town, or neighborhood?",
        value: "settlement",
        matches: [
            'city','town','village','suburb','county','locality'
        ],
        description: "Places that represent a whole populated area rather than a single building."
    },

    // -------------------------------------------------------------------------
    // TIER 2 — ACTIVITY TYPE (what do people do there?)
    // -------------------------------------------------------------------------

    {
        text: "Is the main purpose there to buy something?",
        type: 'ambiguous',
        value: "shopping",
        matches: [
            'restaurant','fast_food','cafe','bar','pub','biergarten','food_court','bakery',
            'supermarket','convenience','grocery_store','grocery','mall','clothes',
            'department_store','bookshop','computer_shop','mobile_phone_shop','shoe_shop',
            'sports_shop','furniture_shop','gift_shop','florist','toy_shop','jeweller',
            'stationery','newsagent','butcher','greengrocer','video_shop','market_place',
            'chemist','bicycle_shop','car_dealership','garden_centre','general'
        ],
        // Pharmacies sell goods but are primarily healthcare; opticians sell glasses but are a service.
        // Fuel/EV stations sell fuel and snacks — shopping happens there but it's not the primary purpose
        alsoMatches: ['pharmacy','optician','kiosk','fuel','charging_station'],
        description: "Places where the main purpose is purchasing goods."
    },

    {
        text: "Is it primarily a place to eat or drink?",
        type: 'ambiguous',
        value: "food",
        matches: [
            'restaurant','fast_food','cafe','bar','pub','biergarten','food_court','bakery'
        ],
        // Eating/drinking is incidental — don't exclude these on 'yes'
        alsoMatches: [
            'school','college','university','kindergarten',
            'personal_residence','personal_workplace',
            'hospital','nursing_home','sports_centre','stadium',
            'community_centre','theatre','cinema',
            'fuel',          // gas stations have snacks/drinks
            'convenience',   // convenience stores sell food and drinks
            'kiosk',
            'hotel','motel','hostel','guesthouse','guest_house'
        ],
        description: "Places primarily visited for food or drinks."
    },

    {
        text: "Is it mainly used for recreation or leisure?",
        value: "recreation",
        type: 'ambiguous',
        matches: [
            'park','dog_park','playground','golf_course','sports_centre','sports_hall','pitch',
            'swimming_pool','stadium','zoo','theme_park','ice_rink','track',
            'picnic_site','hunting_stand','shelter'
        ],
        alsoMatches: [
            'museum','theatre','cinema','arts_centre','nightclub','community_centre',
            'beach','marina'
        ],
        description: "Places people visit for fun, sport, or recreation."
    },

    {
        text: "Is it related to education or learning?",
        value: "education",
        type: 'ambiguous',
        matches: [
            'school','kindergarten','college','university','library','driving_school'
        ],
        alsoMatches: ['museum','community_centre'],
        description: "Places where people go to study, learn, or do research."
    },

    {
        text: "Is it related to healthcare or medicine?",
        value: "healthcare",
        type: 'ambiguous',
        matches: [
            'hospital','clinic','doctors','dentist','pharmacy','veterinary','nursing_home','optician'
        ],
        description: "Places where people receive medical, dental, or veterinary care."
    },

    {
        text: "Is it a place of worship or religion?",
        value: "religion",
        type: 'ambiguous',
        matches: [
            'church','place_of_worship','mosque','synagogue','temple','chapel',
            'monastery','shrine','wayside_cross','wayside_shrine'
        ],
        description: "Places primarily used for religious worship or practice."
    },

    {
        text: "Is staying overnight a primary reason people go there?",
        value: "lodging",
        type: 'ambiguous',
        matches: [
            'hotel','motel','hostel','guesthouse','guest_house','chalet','camp_site',
            'caravan_site','alpine_hut'
        ],
        alsoMatches: ['personal_residence'],
        description: "Places where visitors stay overnight while traveling."
    },

    {
        text: "Is it run by the government or a public service?",
        value: "government",
        type: 'ambiguous',
        matches: [
            'police','fire_station','courthouse','post_office','town_hall','embassy',
            'prison','public_building','military'
        ],
        description: "Government offices or public service buildings."
    },

    {
        text: "Is it mainly a cultural or arts venue?",
        value: "culture",
        type: 'ambiguous',
        matches: [
            'museum','theatre','cinema','arts_centre','art_gallery','nightclub',
            'community_centre','social_facility'
        ],
        alsoMatches: ['library','stadium'],
        description: "Places dedicated to arts, entertainment, or community culture."
    },

    {
        text: "Is it primarily for a personal service (not buying goods)?",
        value: "personal_service",
        type: 'ambiguous',
        matches: [
            'hairdresser','beauty_shop','laundry','car_wash','car_rental',
            'bicycle_rental','car_sharing','travel_agent','driving_school'
        ],
        alsoMatches: ['optician','doctors','dentist','veterinary'],
        description: "Places where people go to have something done for them."
    },

    {
        text: "Is it related to vehicles or transportation?",
        value: "transport_related",
        type: 'ambiguous',
        matches: [
            'car_dealership','car_rental','car_sharing','car_wash','bicycle_shop',
            'bicycle_rental','bus_station','ferry_terminal','airport','train_station',
            'parking','bicycle_parking'
        ],
        alsoMatches: ['fuel','charging_station'],
        description: "Places related to cars, bikes, or public transport."
    },

    {
        text: "Is it a financial institution (bank, ATM, currency exchange)?",
        value: "finance",
        type: 'ambiguous',
        matches: [
            'bank','atm','bureau_de_change'
        ],
        description: "Banks, ATMs, and currency services."
    },

    // -------------------------------------------------------------------------
    // TIER 3 — MORE SPECIFIC SPLITS
    // -------------------------------------------------------------------------

    {
        text: "Is it a sit-down restaurant (not fast food)?",
        value: "sit_down_restaurant",
        parent: "food",
        type: 'ambiguous',
        matches: ['restaurant'],
        alsoMatches: ['bar','pub','biergarten','food_court'],
        description: "Full-service restaurants where you are seated and served."
    },

    {
        text: "Is it a fast food restaurant or quick-service place?",
        value: "fast_food_place",
        parent: "food",
        type: 'ambiguous',
        matches: ['fast_food'],
        alsoMatches: ['bakery','cafe','food_court','kiosk'],
        description: "Quick-service restaurants and fast food chains."
    },

    {
        text: "Is it a cafe, coffee shop, or bakery?",
        value: "cafe_or_bakery",
        parent: "food",
        type: 'ambiguous',
        matches: ['cafe','bakery'],
        alsoMatches: ['fast_food','restaurant','kiosk'],
        description: "Cafes, coffee shops, and bakeries."
    },

    {
        text: "Is it a bar, pub, or nightclub?",
        value: "bar_or_nightclub",
        parent: "food",
        type: 'ambiguous',
        matches: ['bar','pub','biergarten','nightclub'],
        alsoMatches: ['restaurant','cafe'],
        description: "Bars, pubs, breweries, and nightclubs."
    },

    {
        text: "Is it a grocery store or supermarket?",
        value: "grocery",
        parent: "shopping",
        type: 'ambiguous',
        matches: [
            'supermarket','grocery_store','grocery','convenience'
        ],
        // Gas stations have shops — but they aren't grocery stores
        alsoMatches: ['kiosk','market_place'],
        description: "Supermarkets, grocery stores, and convenience stores focused on food."
    },

    {
        text: "Is it a gas station or fuel stop?",
        value: "fuel_station",
        type: 'ambiguous',
        matches: ['fuel'],
        // Gas stations often have shops and snacks but are primarily fuel stops
        alsoMatches: ['charging_station','car_wash','convenience','kiosk'],
        description: "Gas stations or fuel stops (may also have a small shop)."
    },

    {
        text: "Is it a shopping mall or large retail center?",
        value: "mall",
        parent: "shopping",
        type: 'ambiguous',
        matches: ['mall','department_store','market_place'],
        alsoMatches: ['clothes','shoe_shop','furniture_shop'],
        description: "Large shopping malls or multi-store retail centers."
    },

    {
        text: "Is it a pharmacy or drug store?",
        value: "pharmacy",
        parent: "healthcare",
        type: 'ambiguous',
        matches: ['pharmacy','chemist'],
        alsoMatches: ['convenience','supermarket'],
        description: "Pharmacies and drug stores."
    },

    {
        text: "Is it a school (K-12, not college or university)?",
        value: "k12_school",
        parent: "education",
        type: 'ambiguous',
        matches: ['school','kindergarten'],
        description: "Kindergartens through high schools."
    },

    {
        text: "Is it a college or university (higher education)?",
        value: "higher_education",
        parent: "education",
        type: 'ambiguous',
        matches: ['college','university'],
        description: "Colleges, universities, and higher education institutions."
    },

    {
        text: "Is it a library?",
        value: "library",
        parent: "education",
        type: 'ambiguous',
        matches: ['library'],
        description: "Public or institutional libraries."
    },

    {
        text: "Is it a hospital or emergency medical facility?",
        value: "hospital",
        parent: "healthcare",
        type: 'ambiguous',
        matches: ['hospital'],
        alsoMatches: ['clinic','nursing_home'],
        description: "Hospitals and emergency medical centers."
    },

    {
        text: "Is it a doctor's office, clinic, or medical practice?",
        value: "clinic_or_doctors",
        parent: "healthcare",
        type: 'ambiguous',
        matches: ['doctors','clinic','optician','dentist'],
        alsoMatches: ['hospital','pharmacy'],
        description: "Outpatient medical offices, clinics, and specialists."
    },

    {
        text: "Is it a park or green outdoor space?",
        value: "park",
        parent: "recreation",
        type: 'ambiguous',
        matches: ['park','dog_park','playground'],
        alsoMatches: ['golf_course','pitch','nature_reserve'],
        description: "Public parks, playgrounds, and green outdoor spaces."
    },

    {
        text: "Is it a sports facility (gym, arena, field, pool)?",
        value: "sports_facility",
        parent: "recreation",
        type: 'ambiguous',
        matches: [
            'sports_centre','sports_hall','swimming_pool','stadium','ice_rink',
            'pitch','golf_course'
        ],
        alsoMatches: ['playground','park'],
        description: "Sports centers, gyms, pools, arenas, and athletic fields."
    },

    {
        text: "Is it a museum or art gallery?",
        value: "museum_or_gallery",
        parent: "culture",
        type: 'ambiguous',
        matches: ['museum','art_gallery'],
        alsoMatches: ['arts_centre','library'],
        description: "Museums, art galleries, and exhibit spaces."
    },

    {
        text: "Is it a movie theater or performing arts venue?",
        value: "theatre_or_cinema",
        parent: "culture",
        type: 'ambiguous',
        matches: ['theatre','cinema'],
        alsoMatches: ['arts_centre','nightclub'],
        description: "Movie theaters, stage theaters, and performing arts venues."
    },

    {
        text: "Is it a hotel, motel, or place to stay while traveling?",
        value: "hotel_or_motel",
        parent: "lodging",
        type: 'ambiguous',
        matches: ['hotel','motel','guesthouse','guest_house','hostel'],
        alsoMatches: ['camp_site','chalet'],
        description: "Hotels, motels, hostels, and guest houses."
    },

    {
        text: "Is it a campground or outdoor lodging?",
        value: "campground",
        parent: "lodging",
        type: 'ambiguous',
        matches: ['camp_site','caravan_site','chalet','alpine_hut'],
        description: "Campgrounds, RV parks, chalets, and outdoor stays."
    },

    {
        text: "Is it a police station, fire station, or emergency service?",
        value: "emergency_services",
        parent: "government",
        type: 'ambiguous',
        matches: ['police','fire_station'],
        description: "Police stations, fire stations, and emergency response facilities."
    },

    {
        text: "Is it a post office, town hall, or other civic building?",
        value: "civic_building",
        parent: "government",
        type: 'ambiguous',
        matches: ['post_office','town_hall','courthouse','public_building','embassy'],
        description: "Post offices, courthouses, town halls, and civic facilities."
    },

    {
        text: "Is it a parking lot or garage?",
        value: "parking",
        type: 'ambiguous',
        matches: ['parking','bicycle_parking'],
        description: "Public or private parking lots and garages."
    },

    {
        text: "Is it a graveyard or cemetery?",
        value: "graveyard",
        type: 'ambiguous',
        matches: ['graveyard'],
        description: "Cemeteries and graveyards."
    },

    // -------------------------------------------------------------------------
    // TIER 4 — OUTDOOR / NATURE / INFRASTRUCTURE
    // -------------------------------------------------------------------------

    {
        text: "Is it mainly a landmark or historic site?",
        value: "historic",
        type: 'ambiguous',
        matches: [
            'castle','ruins','fort','battlefield','memorial','monument','archaeological'
        ],
        alsoMatches: ['artwork','attraction','viewpoint'],
        description: "Historic or culturally significant landmarks."
    },

    {
        text: "Is it a scenic spot or viewpoint?",
        value: "scenic",
        type: 'ambiguous',
        matches: [
            'viewpoint','observation_tower','lighthouse','tower','island'
        ],
        description: "Places people visit mainly for the view or scenery."
    },

    {
        text: "Is it a public monument, statue, or piece of outdoor art?",
        value: "monument_or_art",
        type: 'ambiguous',
        matches: ['monument','memorial','artwork','attraction'],
        alsoMatches: ['castle','ruins','fort'],
        description: "Public monuments, statues, memorials, and outdoor art."
    },

    {
        text: "Is it mainly infrastructure or a utility facility?",
        value: "utility",
        type: 'ambiguous',
        matches: [
            'comms_tower','water_tower','water_works','wastewater_plant','water_mill','water_well'
        ],
        description: "Utility infrastructure like water towers, treatment plants, and comm towers."
    },

    {
        text: "Is it something small that people use briefly in public (bench, toilet, recycling)?",
        value: "small_amenity",
        type: 'ambiguous',
        matches: [
            'bench','drinking_water','post_box','telephone','toilet','vending_machine',
            'vending_any','waste_basket','recycling','recycling_glass','recycling_paper',
            'recycling_metal','recycling_clothes','fountain'
        ],
        description: "Small public amenities people use briefly outdoors."
    },

    {
        text: "Is it a farm or rural agricultural property?",
        value: "farm",
        type: 'ambiguous',
        matches: ['farm'],
        description: "Farms, ranches, or agricultural properties."
    },

    {
        text: "Is it an electric vehicle charging station?",
        value: "ev_charging",
        type: 'ambiguous',
        matches: ['charging_station'],
        alsoMatches: ['fuel','parking'],
        description: "EV charging stations (often at parking lots or retail locations)."
    },

    {
        text: "Is it a zoo, aquarium, or animal attraction?",
        value: "zoo",
        type: 'ambiguous',
        matches: ['zoo'],
        alsoMatches: ['theme_park','park','attraction'],
        description: "Zoos, aquariums, and wildlife attractions."
    },

    {
        text: "Is it a theme park or amusement park?",
        value: "theme_park",
        type: 'ambiguous',
        matches: ['theme_park'],
        alsoMatches: ['zoo','stadium','park'],
        description: "Theme parks and amusement parks."
    },

    {
        text: "Is it a bus station, train station, or transit hub?",
        value: "transit_hub",
        type: 'ambiguous',
        matches: ['bus_station','train_station','ferry_terminal','airport'],
        description: "Public transit hubs including bus, rail, and ferry terminals."
    },

];
