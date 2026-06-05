import requests
from flask import Blueprint, request, jsonify
from extensions import limiter
from math import radians, cos, sin, asin, sqrt

doctors_bp = Blueprint("doctors", __name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]
HEADERS = {"User-Agent": "MedClearAI/3.0 (portfolio-project; contact=student)"}

SPECIALTY_TAGS = {
    "cardiologist":       ["cardiology", "cardio", "heart"],
    "dermatologist":      ["dermatology", "skin"],
    "endocrinologist":    ["endocrinology", "diabetes", "thyroid"],
    "neurologist":        ["neurology", "neuro"],
    "nephrologist":       ["nephrology", "kidney", "renal"],
    "hepatologist":       ["hepatology", "liver"],
    "pulmonologist":      ["pulmonology", "respiratory", "lung"],
    "rheumatologist":     ["rheumatology", "arthritis"],
    "ophthalmologist":    ["ophthalmology", "eye"],
    "gastroenterologist": ["gastroenterology", "gastro"],
    "oncologist":         ["oncology", "cancer"],
    "psychiatrist":       ["psychiatry", "mental health"],
    "orthopedist":        ["orthopedics", "orthopaedics", "bone"],
    "general physician":  ["general", "family", "gp", "primary"],
}


def haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return R * 2 * asin(sqrt(a))


def geocode(location: str):
    try:
        r = requests.get(
            NOMINATIM_URL,
            params={"q": location, "format": "json", "limit": 1},
            headers=HEADERS,
            timeout=10,
        )
        data = r.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"]), data[0].get("display_name", location)
    except Exception as e:
        print(f"[GEO] Nominatim error: {e}")
    return None, None, None


def build_overpass_query(lat: float, lon: float, radius: int) -> str:
    return f"""
[out:json][timeout:25];
(
  node["amenity"="hospital"](around:{radius},{lat},{lon});
  node["amenity"="clinic"](around:{radius},{lat},{lon});
  node["amenity"="doctors"](around:{radius},{lat},{lon});
  node["healthcare"="doctor"](around:{radius},{lat},{lon});
  node["healthcare"="clinic"](around:{radius},{lat},{lon});
  node["healthcare"="hospital"](around:{radius},{lat},{lon});
  way["amenity"="hospital"](around:{radius},{lat},{lon});
  way["amenity"="clinic"](around:{radius},{lat},{lon});
  way["healthcare"="hospital"](around:{radius},{lat},{lon});
);
out center tags;
"""


def query_overpass(lat: float, lon: float) -> list:
    for radius in [5000, 10000, 20000]:
        query = build_overpass_query(lat, lon, radius)
        for url in OVERPASS_URLS:
            try:
                r = requests.post(
                    url,
                    data={"data": query},
                    headers=HEADERS,
                    timeout=28,
                )
                if r.status_code == 200:
                    elements = r.json().get("elements", [])
                    if elements:
                        print(f"[OVERPASS] {len(elements)} results @ radius={radius} from {url}")
                        return elements
            except Exception as e:
                print(f"[OVERPASS] Error {url}: {e}")
    return []


def specialty_matches(tags: dict, specialty: str) -> bool:
    """Check if OSM tags suggest this facility handles the given specialty."""
    specialty_lower = specialty.lower()
    keywords = SPECIALTY_TAGS.get(specialty_lower, [specialty_lower])
    combined = " ".join(str(v) for v in tags.values()).lower()
    return any(kw in combined for kw in keywords)


def elements_to_doctors(elements: list, clat: float, clon: float, specialty: str) -> list:
    results = []
    seen: set = set()

    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("operator") or tags.get("brand")
        if not name:
            continue

        key = name.lower().strip()
        if key in seen:
            continue
        seen.add(key)

        dlat = el.get("lat") or el.get("center", {}).get("lat", clat)
        dlon = el.get("lon") or el.get("center", {}).get("lon", clon)
        dist = haversine(clat, clon, float(dlat), float(dlon))

        # Build address from OSM tags
        addr_parts = []
        for tag in ["addr:housenumber", "addr:street", "addr:suburb", "addr:city", "addr:state"]:
            v = tags.get(tag)
            if v:
                addr_parts.append(v)
        address = ", ".join(addr_parts) if addr_parts else tags.get("addr:full", "")

        # Determine facility type
        amenity = tags.get("amenity") or tags.get("healthcare") or "Medical Facility"
        facility_type = amenity.replace("_", " ").title()

        # Phone
        phone = (
            tags.get("phone")
            or tags.get("contact:phone")
            or tags.get("contact:mobile")
            or tags.get("telephone")
        )

        # Website
        website = tags.get("website") or tags.get("contact:website") or tags.get("url")

        # Google Maps URL
        maps_url = (
            f"https://www.google.com/maps/search/?api=1&query="
            f"{requests.utils.quote(name + ' ' + (address or ''))}"
        )

        results.append({
            "name": name,
            "specialty": specialty.title() if specialty else facility_type,
            "type": facility_type,
            "address": address or "Address not available",
            "distance_km": round(dist, 2),
            "phone": phone,
            "website": website,
            "maps_url": maps_url,
        })

    # Sort by distance, return top 8
    results.sort(key=lambda x: x["distance_km"])
    return results[:8]


@doctors_bp.route("/api/doctors", methods=["POST"])
@limiter.limit("10 per minute")
def get_doctors():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Invalid request."}), 400

        location = (data.get("location") or "").strip()
        specialty = (data.get("specialty") or "general physician").strip().lower()

        if not location:
            return jsonify({"error": "Location is required."}), 400

        lat, lon, display_name = geocode(location)
        if lat is None:
            return jsonify({
                "error": f"Could not find '{location}'. Try a city name like 'Hyderabad', 'New York', or 'London'."
            }), 404

        print(f"[DOCTORS] '{location}' → ({lat}, {lon})")
        elements = query_overpass(lat, lon)
        print(f"[DOCTORS] {len(elements)} OSM elements found")

        doctors = elements_to_doctors(elements, lat, lon, specialty)

        if not doctors:
            return jsonify({
                "doctors": [],
                "note": (
                    f"No clinics or hospitals found near '{location}' within 20 km. "
                    "Try a larger city or a more central area."
                ),
            })

        return jsonify({
            "doctors": doctors,
            "location": display_name,
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
