import os
import json
import requests
import google.generativeai as genai
from flask import Blueprint, request, jsonify

doctors_bp = Blueprint("doctors", __name__)

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash")

# Specialist type → OSM amenity tags mapping
SPECIALIST_TAGS = {
    "cardiologist": ["cardiology", "heart", "cardiac"],
    "endocrinologist": ["endocrinology", "diabetes", "hormone"],
    "gastroenterologist": ["gastroenterology", "gastro", "digestive"],
    "nephrologist": ["nephrology", "kidney", "renal"],
    "hematologist": ["hematology", "blood", "haematology"],
    "neurologist": ["neurology", "neural", "neuro"],
    "pulmonologist": ["pulmonology", "pulmonary", "respiratory", "lung"],
    "hepatologist": ["hepatology", "liver"],
    "general physician": ["general_practitioner", "gp", "family_medicine"],
    "internist": ["internal_medicine", "internist"],
    "rheumatologist": ["rheumatology"],
    "oncologist": ["oncology", "cancer"],
    "urologist": ["urology", "urological"],
    "dermatologist": ["dermatology", "skin"],
    "ophthalmologist": ["ophthalmology", "eye"],
}

def query_overpass(lat, lon, radius_m, specialties):
    """Query OpenStreetMap Overpass API for nearby medical facilities."""
    # Build query for hospitals and clinics near the location
    queries = []
    for specialty in specialties:
        tags = SPECIALIST_TAGS.get(specialty.lower(), ["hospital"])
        for tag in tags[:2]:  # limit to first 2 tags per specialty
            queries.append(f'node["healthcare"="{tag}"](around:{radius_m},{lat},{lon});')
            queries.append(f'node["amenity"="hospital"]["name"~"{tag}",i](around:{radius_m},{lat},{lon});')
    
    # Also get general hospitals/clinics as fallback
    queries.append(f'node["amenity"="hospital"](around:{radius_m},{lat},{lon});')
    queries.append(f'node["amenity"="clinic"](around:{radius_m},{lat},{lon});')
    queries.append(f'node["healthcare"="doctor"](around:{radius_m},{lat},{lon});')

    overpass_query = f"""
[out:json][timeout:10];
(
  {''.join(queries[:12])}
);
out body 20;
"""
    try:
        resp = requests.post(
            "https://overpass-api.de/api/interpreter",
            data={"data": overpass_query},
            timeout=12
        )
        if resp.status_code == 200:
            return resp.json().get("elements", [])
    except Exception:
        pass
    return []

def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance in km between two coordinates."""
    from math import radians, cos, sin, asin, sqrt
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    return R * 2 * asin(sqrt(a))

@doctors_bp.route("/api/doctors", methods=["POST"])
def get_doctors():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid request."}), 400

    lat = data.get("lat")
    lon = data.get("lon")
    specialists = data.get("specialists", ["general physician"])

    if lat is None or lon is None:
        return jsonify({"error": "Location not provided."}), 400

    try:
        lat = float(lat)
        lon = float(lon)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid coordinates."}), 400

    # Query OSM for nearby facilities
    elements = query_overpass(lat, lon, radius_m=5000, specialties=specialists)

    doctors = []
    seen_names = set()

    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name", "").strip()

        if not name or name.lower() in seen_names:
            continue
        seen_names.add(name.lower())

        el_lat = el.get("lat", lat)
        el_lon = el.get("lon", lon)
        distance_km = haversine(lat, lon, el_lat, el_lon)

        # Determine specialty from tags
        specialty = "General Practitioner"
        healthcare = tags.get("healthcare", "")
        amenity = tags.get("amenity", "")
        speciality_tag = tags.get("healthcare:speciality", tags.get("speciality", ""))

        if speciality_tag:
            specialty = speciality_tag.replace("_", " ").title()
        elif healthcare == "hospital":
            specialty = "Hospital"
        elif amenity == "clinic":
            specialty = "Clinic"
        elif healthcare == "doctor":
            specialty = "General Practitioner"

        # Build maps directions URL
        maps_url = f"https://www.google.com/maps/dir/?api=1&destination={el_lat},{el_lon}"

        doctors.append({
            "name": name,
            "specialty": specialty,
            "distance_km": round(distance_km, 2),
            "address": tags.get("addr:full") or tags.get("addr:street") or "See on map",
            "phone": tags.get("phone") or tags.get("contact:phone") or None,
            "maps_url": maps_url,
            "lat": el_lat,
            "lon": el_lon,
            "opening_hours": tags.get("opening_hours") or None
        })

    # Sort by distance
    doctors.sort(key=lambda d: d["distance_km"])
    doctors = doctors[:8]  # Return top 8

    # If no results from OSM, return helpful message
    if not doctors:
        return jsonify({
            "doctors": [],
            "message": "No facilities found nearby. Try expanding your search or use Google Maps to search for specialists directly.",
            "specialists": specialists,
            "maps_search_url": f"https://www.google.com/maps/search/{'+'.join(specialists[0].split())}+near+me"
        })

    return jsonify({
        "doctors": doctors,
        "specialists": specialists,
        "total": len(doctors)
    })
