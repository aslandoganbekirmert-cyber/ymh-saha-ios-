#!/bin/bash
# Seed Data for SAHA'M
# Run this in a new terminal window while backend is running

echo "⏳ Creating Projects..."

curl -X POST http://localhost:3000/projects \
   -H "Content-Type: application/json" \
   -d '{"code": "1853", "name": "KADIKOY HATTI", "city": "ISTANBUL", "district": "KADIKOY", "status": "ACTIVE", "gps_lat": 41.0082, "gps_lng": 28.9784}'

echo ""
echo "-----------------------------------"

curl -X POST http://localhost:3000/projects \
   -H "Content-Type: application/json" \
   -d '{"code": "1901", "name": "BESIKTAS MEYDAN", "city": "ISTANBUL", "district": "BESIKTAS", "status": "ACTIVE", "gps_lat": 41.0422, "gps_lng": 29.0067}'

echo ""
echo "-----------------------------------"

curl -X POST http://localhost:3000/projects \
   -H "Content-Type: application/json" \
   -d '{"code": "2024", "name": "ANKARA MERKEZ", "city": "ANKARA", "district": "CANKAYA", "status": "ACTIVE", "gps_lat": 39.9334, "gps_lng": 32.8597}'

echo ""
echo "-----------------------------------"

# UNASSIGNED PROJECT (Safety Net)
curl -X POST http://localhost:3000/projects \
   -H "Content-Type: application/json" \
   -d '{"code": "0000", "name": "UNASSIGNED / ORPHAN", "city": "-", "district": "-", "status": "ACTIVE", "gps_lat": 0, "gps_lng": 0}'


echo ""
echo "✅ Seed Complete! Refresh the Mobile App."
