#!/bin/bash

# Apache Bench Load Testing Script
# Baseline performance testing without k6 dependency
# Run: bash tests/load/apache-bench-test.sh

set -e

API_URL="http://localhost:3000"
TEST_EMAIL="user@example.com"
TEST_PASSWORD="senha123"

echo "=========================================="
echo "PRE_VALIDADOR_SEFAZ — Load Test (Apache Bench)"
echo "=========================================="
echo ""

# Check if ab command is available
if ! command -v ab &> /dev/null; then
  echo "❌ Apache Bench (ab) not found. Install: apt-get install apache2-utils"
  exit 1
fi

# Step 1: Login to get token
echo "📝 Step 1: Authentication..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"senha\":\"$TEST_PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Authentication failed"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Authenticated. Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Prepare test data
echo "📝 Step 2: Preparing test data..."

VALID_XML='<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe12345678901234567890123456789012345678901234" versao="4.00">
      <ide>
        <cUF>43</cUF>
        <nNF>123456</nNF>
        <serie>1</serie>
        <dEmi>2024-05-21</dEmi>
        <CFOP>5102</CFOP>
      </ide>
      <emit><CNPJ>12345678901234</CNPJ></emit>
      <dest><CNPJ>98765432109876</CNPJ></dest>
      <det nItem="1">
        <prod>
          <CFOP>5102</CFOP>
          <xProd>Produto teste</xProd>
          <vItem>1000.00</vItem>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <CST>00</CST>
              <pICMS>18</pICMS>
              <vBC>1000.00</vBC>
            </ICMS00>
          </ICMS>
        </imposto>
      </det>
      <total>
        <vNF>1000.00</vNF>
        <vBC>1000.00</vBC>
      </total>
    </infNFe>
  </NFe>
</nfeProc>'

PAYLOAD="{\"xmlContent\":\"$VALID_XML\",\"empresaId\":\"12345678-1234-1234-1234-123456789012\"}"

# Escape payload for ab
PAYLOAD_FILE=$(mktemp)
echo -n "$PAYLOAD" > "$PAYLOAD_FILE"

echo "✅ Test data prepared"
echo ""

# Step 3: Health check
echo "📝 Step 3: Health check..."
HEALTH=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/health")

if [ "$HEALTH" != "200" ]; then
  echo "❌ Health check failed (HTTP $HEALTH)"
  exit 1
fi

echo "✅ API healthy"
echo ""

# Step 4: Warmup (small load)
echo "📝 Step 4: Warmup (10 requests)..."
ab -n 10 -c 1 -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -p "$PAYLOAD_FILE" \
  "$API_URL/api/validar" > /dev/null 2>&1 || true

echo "✅ Warmup complete"
echo ""

# Step 5: Main load test
echo "=========================================="
echo "🔥 MAIN LOAD TEST: 100 requests, 10 concurrent"
echo "=========================================="
echo ""

ab -n 100 -c 10 -g results.tsv -r \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -p "$PAYLOAD_FILE" \
  "$API_URL/api/validar"

echo ""
echo "=========================================="
echo "✅ Load test complete"
echo "=========================================="
echo ""

# Step 6: Dashboard endpoint test
echo "📝 Step 5: Dashboard Endpoint (50 requests)..."
ab -n 50 -c 5 \
  -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/validacoes/minhas?page=1&limit=20" > /dev/null 2>&1 || true

echo "✅ Dashboard endpoint tested"
echo ""

# Cleanup
rm -f "$PAYLOAD_FILE"

# Step 7: Logout
echo "🔐 Logout..."
curl -s -X POST "$API_URL/api/auth/logout" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo "✅ Test session complete"
echo ""

echo "💾 Results saved to results.tsv (can be imported to Excel)"
echo ""
echo "📊 Key Metrics:"
echo "  - Look at 'Time per request' for average latency"
echo "  - Look at 'Requests per second' for throughput"
echo "  - Target: < 500ms per request, > 20 req/s"
