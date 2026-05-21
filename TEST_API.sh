#!/bin/bash

# PRE_VALIDADOR_SEFAZ - API Testing Script
# Tests the deployed API on Vercel

API_URL="${1:-https://prevalidadorsefaz-onevuw1zf-rodrigopaesrj-8422s-projects.vercel.app}"
ENDPOINT="$API_URL/api/validar"

echo "=========================================="
echo "PRE_VALIDADOR_SEFAZ - API Test Suite"
echo "=========================================="
echo ""
echo "Testing API at: $ENDPOINT"
echo ""

# Test 1: Valid XML with good CFOP
echo "Test 1: Valid XML (CFOP 5102, positive values)"
RESPONSE=$(curl -s "$ENDPOINT" -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "xmlContent": "<?xml version=\"1.0\"?><root><CFOP>5102</CFOP><vProd>1000.00</vProd><vBC>900.00</vBC></root>"
  }')

echo "$RESPONSE" | jq . 2>/dev/null && STATUS1="PASS" || STATUS1="FAIL"
echo "Result: $STATUS1"
echo ""

# Test 2: Invalid CFOP
echo "Test 2: Invalid CFOP (9999)"
RESPONSE=$(curl -s "$ENDPOINT" -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "xmlContent": "<?xml version=\"1.0\"?><root><CFOP>9999</CFOP><vProd>1000.00</vProd></root>"
  }')

echo "$RESPONSE" | jq . 2>/dev/null && STATUS2="PASS" || STATUS2="FAIL"
echo "Result: $STATUS2"
echo ""

# Test 3: Negative value
echo "Test 3: Negative Product Value"
RESPONSE=$(curl -s "$ENDPOINT" -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "xmlContent": "<?xml version=\"1.0\"?><root><vProd>-100.00</vProd></root>"
  }')

echo "$RESPONSE" | jq . 2>/dev/null && STATUS3="PASS" || STATUS3="FAIL"
echo "Result: $STATUS3"
echo ""

# Test 4: Malformed XML
echo "Test 4: Malformed XML"
RESPONSE=$(curl -s "$ENDPOINT" -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "xmlContent": "Not XML at all"
  }')

echo "$RESPONSE" | jq . 2>/dev/null && STATUS4="PASS" || STATUS4="FAIL"
echo "Result: $STATUS4"
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "Test 1 (Valid XML):        $STATUS1"
echo "Test 2 (Invalid CFOP):     $STATUS2"
echo "Test 3 (Negative Value):   $STATUS3"
echo "Test 4 (Malformed XML):    $STATUS4"
echo ""

TOTAL="PASS"
[[ "$STATUS1" == "FAIL" ]] && TOTAL="FAIL"
[[ "$STATUS2" == "FAIL" ]] && TOTAL="FAIL"
[[ "$STATUS3" == "FAIL" ]] && TOTAL="FAIL"
[[ "$STATUS4" == "FAIL" ]] && TOTAL="FAIL"

echo "Overall Result: $TOTAL ✅" || echo "Overall Result: FAIL ❌"
echo ""
