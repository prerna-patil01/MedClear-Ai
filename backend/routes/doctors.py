import requests
from flask import Blueprint, request, jsonify

doctors_bp = Blueprint("doctors", __name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",  # fallback mirror
]

HEADERS = {"User-Agent": "MedClear-AI/1.0 (medical-report-explainer)"}


# ---------------------------------------------------------------------------
# Geo helpers
# ---------------------------------------------------------------------------

def geocode(location: str) -> tuple[float, float] | None:
    """Convert location string → (lat, lon) using Nominatim."""
    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={"q": location, "format": "json", "limit": 1},
            headers=HEADERS,
            timeout=10,
        )
        data = resp.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as exc:
        print("NOMINATIM ERROR:", exc)
    return None


def haversine(lat1, lon1, lat2, lon2) -> float:
    from math import radians, cos, sin, asin, sqrt
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return R * 2 * asin(sqrt(a))


def query_overpass(lat: float, lon: float, radius: int = 5000) -> list:
    """
    Query Overpass for hospitals, clinics, and doctors near (lat, lon).
    Tries primary URL then fallback mirror.
    Increases radius to 10 km if first attempt returns nothing.
    """
    query_template = """
[out:json][timeout:20];
(
  node["amenity"="hospital"](around:{radius},{lat},{lon});
  node["amenity"="clinic"](around:{radius},{lat},{lon});
  node["healthcare"="doctor"](around:{radius},{lat},{lon});
  node["amenity"="doctors"](around:{radius},{lat},{lon});
  way["amenity"="hospital"](around:{radius},{lat},{lon});
  way["amenity"="clinic"](around:{radius},{lat},{lon});
);
out center;
"""

    for attempt_radius in [radius, radius * 2]:
        query = query_template.format(
            radius=attempt_radius, lat=lat, lon=lon
        )
        for url in OVERPASS_URLS:
            try:
                resp = requests.post(
                    url,
                    data={"data": query},
                    headers=HEADERS,
                    timeout=25,
                )
                if resp.status_code == 200:
                    elements = resp.json().get("elements", [])
                    if elements:
                        return elements
                    print(f"[OVERPASS] 0 results at radius={attempt_radius} from {url}")
                else:
                    print(f"[OVERPASS] HTTP {resp.status_code} from {url}")
            except Exception as exc:
                print(f"[OVERPASS] Error from {url}: {exc}")

    return []


def elements_to_doctors(elements: list, center_lat: float, center_lon: float, specialty: str) -> list:
    doctors = []
    seen: set[str] = set()

    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("operator")
        if not name:
            continue

        key = name.lower().strip()
        if key in seen:
            continue
        seen.add(key)

        # For ways, Overpass returns a "center" key
        dlat = el.get("lat") or el.get("center", {}).get("lat", center_lat)
        dlon = el.get("lon") or el.get("center", {}).get("lon", center_lon)

        distance = haversine(center_lat, center_lon, float(dlat), float(dlon))

        # Build a human-readable address from OSM tags
        addr_parts = []
        for tag in ["addr:housenumber", "addr:street", "addr:suburb", "addr:city"]:
            v = tags.get(tag)
            if v:
                addr_parts.append(v)
        address = ", ".join(addr_parts) if addr_parts else tags.get("addr:full", "Address unavailable")

        doctors.append({
            "name": name,
            "specialty": specialty.title(),
            "address": address,
            "distance_km": round(distance, 2),
            "phone": tags.get("phone") or tags.get("contact:phone") or tags.get("contact:mobile"),
            "maps_url": f"https://www.google.com/maps/search/?api=1&query={dlat},{dlon}",
        })

    doctors.sort(key=lambda x: x["distance_km"])
    return doctors[:8]


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@doctors_bp.route("/api/doctors", methods=["POST"])
def get_doctors():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Invalid request."}), 400

        location = (data.get("location") or "").strip()
        specialty = (data.get("specialty") or "general physician").strip()

        if not location:
            return jsonify({"error": "Location is required."}), 400

        # Geocode
        coords = geocode(location)
        if not coords:
            return jsonify({
                "error": f"Could not find location '{location}'. Try a city name like 'Hyderabad' or 'New York'."
            }), 404

        lat, lon = coords
        print(f"[DOCTORS] Geocoded '{location}' → ({lat}, {lon})")

        # Query Overpass
        elements = query_overpass(lat, lon, radius=5000)
        print(f"[DOCTORS] Got {len(elements)} elements from Overpass")

        doctors = elements_to_doctors(elements, lat, lon, specialty)

        if not doctors:
            # Return empty list with a helpful note rather than an error
            return jsonify({
                "doctors": [],
                "note": (
                    f"No clinics or hospitals found within 10 km of '{location}'. "
                    "Try a larger city or a more central location."
                ),
            })

        return jsonify({"doctors": doctors})

    except Exception as exc:
        import traceback
        print("DOCTORS ERROR:")
        traceback.print_exc()
        return jsonify({"error": str(exc)}), 500
