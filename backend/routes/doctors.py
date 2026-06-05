import requests
from flask import Blueprint, request, jsonify

doctors_bp = Blueprint("doctors", __name__)

# Specialist type → OSM tags
SPECIALIST_TAGS = {
    "cardiologist": ["cardiology", "heart", "cardiac"],
    "endocrinologist": ["endocrinology", "diabetes", "hormone"],
    "gastroenterologist": ["gastroenterology", "digestive"],
    "nephrologist": ["nephrology", "kidney", "renal"],
    "hematologist": ["hematology", "blood"],
    "neurologist": ["neurology", "neuro"],
    "pulmonologist": ["pulmonology", "lung", "respiratory"],
    "hepatologist": ["hepatology", "liver"],
    "general physician": ["doctor", "general_practitioner"],
    "internist": ["internal_medicine"],
    "rheumatologist": ["rheumatology"],
    "oncologist": ["oncology"],
    "urologist": ["urology"],
    "dermatologist": ["dermatology"],
    "ophthalmologist": ["ophthalmology"]
}


def haversine(lat1, lon1, lat2, lon2):
    from math import radians, cos, sin, asin, sqrt

    R = 6371

    lat1, lon1, lat2, lon2 = map(
        radians,
        [lat1, lon1, lat2, lon2]
    )

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        sin(dlat / 2) ** 2
        + cos(lat1)
        * cos(lat2)
        * sin(dlon / 2) ** 2
    )

    return R * 2 * asin(sqrt(a))


def query_overpass(lat, lon, radius=5000):
    query = f"""
    [out:json][timeout:15];
    (
      node["amenity"="hospital"](around:{radius},{lat},{lon});
      node["amenity"="clinic"](around:{radius},{lat},{lon});
      node["healthcare"="doctor"](around:{radius},{lat},{lon});
    );
    out body;
    """

    try:
        response = requests.post(
            "https://overpass-api.de/api/interpreter",
            data={"data": query},
            timeout=20
        )

        if response.status_code == 200:
            return response.json().get("elements", [])

    except Exception as e:
        print("OVERPASS ERROR:", e)

    return []


@doctors_bp.route("/api/doctors", methods=["POST"])
def get_doctors():
    try:
        data = request.get_json(silent=True)

        if not data:
            return jsonify({
                "error": "Invalid request."
            }), 400

        location = data.get("location")
        specialty = data.get(
            "specialty",
            "general physician"
        )

        if not location:
            return jsonify({
                "error": "Location is required."
            }), 400

        # Convert city/location → coordinates
        geo_response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": location,
                "format": "json",
                "limit": 1
            },
            headers={
                "User-Agent": "MedClear"
            },
            timeout=10
        )

        geo_data = geo_response.json()

        if not geo_data:
            return jsonify({
                "error": "Location not found."
            }), 404

        lat = float(geo_data[0]["lat"])
        lon = float(geo_data[0]["lon"])

        elements = query_overpass(lat, lon)

        doctors = []
        seen = set()

        for el in elements:
            tags = el.get("tags", {})

            name = tags.get("name")

            if not name:
                continue

            if name.lower() in seen:
                continue

            seen.add(name.lower())

            dlat = el.get("lat", lat)
            dlon = el.get("lon", lon)

            distance = haversine(
                lat,
                lon,
                dlat,
                dlon
            )

            doctors.append({
                "name": name,
                "specialty": specialty.title(),
                "address":
                    tags.get("addr:full")
                    or tags.get("addr:street")
                    or "Address unavailable",
                "distance_km": round(distance, 2),
                "phone":
                    tags.get("phone")
                    or tags.get("contact:phone"),
                "maps_url":
                    f"https://www.google.com/maps/search/?api=1&query={dlat},{dlon}"
            })

        doctors.sort(
            key=lambda x: x["distance_km"]
        )

        doctors = doctors[:8]

        return jsonify({
            "doctors": doctors
        })

    except Exception as e:
        print("DOCTORS ERROR:", str(e))

        return jsonify({
            "error": str(e)
        }), 500
