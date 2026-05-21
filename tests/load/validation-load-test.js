/**
 * Load Testing Suite for PRE_VALIDADOR_SEFAZ
 * Tests performance under concurrent load: 100+ validations/second
 *
 * Run: k6 run tests/load/validation-load-test.js
 * Or: npx k6 run tests/load/validation-load-test.js
 *
 * Metrics:
 * - p95 response time: < 500ms target
 * - p99 response time: < 1000ms target
 * - Error rate: < 1%
 * - Throughput: 100+ validations/second
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Trend, Gauge } from 'k6/metrics';

// Custom metrics
const validationDuration = new Trend('validation_duration');
const validationErrors = new Counter('validation_errors');
const loginDuration = new Trend('login_duration');
const activeConcurrentRequests = new Gauge('concurrent_requests');

// Test credentials
const TEST_USER = {
  email: 'loadtest@example.com',
  senha: 'senha123',
};

// Sample NFe XML for testing
const VALID_XML = `<?xml version="1.0" encoding="UTF-8"?>
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
</nfeProc>`;

// Test configuration
export const options = {
  // Ramp-up: start at 10 VUs, increase to 50 over 30s
  // Sustain: hold 50 VUs for 60s
  // Ramp-down: decrease to 0 over 10s
  stages: [
    { duration: '10s', target: 10, name: 'Warm-up' },
    { duration: '30s', target: 50, name: 'Ramp-up' },
    { duration: '60s', target: 50, name: 'Sustain' },
    { duration: '10s', target: 0, name: 'Cool-down' },
  ],

  thresholds: {
    // p95 response time must be under 500ms
    'http_req_duration{staticAsset:no}': ['p(95)<500'],
    // p99 response time must be under 1000ms
    'http_req_duration{staticAsset:no}': ['p(99)<1000'],
    // Error rate must be under 1%
    'http_req_failed{staticAsset:no}': ['rate<0.01'],
  },

  // Disable sample output to keep logs clean during load test
  discardResponseBodies: true,
};

// Setup: Login once per VU to get token
export function setup() {
  const loginRes = http.post('http://localhost:3000/api/auth/login', JSON.stringify(TEST_USER), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'setup: login successful': (r) => r.status === 200,
  });

  const token = loginRes.json('data.token');
  console.log('Setup complete: authentication token acquired');

  return { token, empresaId: '12345678-1234-1234-1234-123456789012' };
}

// Main test function
export default function (data) {
  const { token, empresaId } = data;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  group('Validation Endpoint', () => {
    // Track concurrent requests
    activeConcurrentRequests.add(1);

    const validationPayload = JSON.stringify({
      xmlContent: VALID_XML,
      empresaId: empresaId,
    });

    const validationRes = http.post(
      'http://localhost:3000/api/validar',
      validationPayload,
      {
        headers,
        tags: { name: 'validation' },
      }
    );

    validationDuration.add(validationRes.timings.duration);

    const success = check(validationRes, {
      'status is 200': (r) => r.status === 200,
      'response has validacaoId': (r) => r.json('validacaoId') !== undefined,
      'response time < 500ms': (r) => r.timings.duration < 500,
      'response time < 1000ms': (r) => r.timings.duration < 1000,
    });

    if (!success) {
      validationErrors.add(1);
    }

    activeConcurrentRequests.add(-1);
  });

  group('Dashboard Endpoint', () => {
    const dashboardRes = http.get(
      'http://localhost:3000/api/validacoes/minhas?page=1&limit=20',
      { headers, tags: { name: 'dashboard' } }
    );

    check(dashboardRes, {
      'dashboard status is 200': (r) => r.status === 200,
      'dashboard has data': (r) => r.json('data') !== undefined,
    });
  });

  // Small delay between iterations to allow system recovery
  sleep(1);
}

// Cleanup: logout after all iterations
export function teardown(data) {
  const { token } = data;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const logoutRes = http.post(
    'http://localhost:3000/api/auth/logout',
    '{}',
    { headers }
  );

  check(logoutRes, {
    'teardown: logout successful': (r) => r.status === 200,
  });

  console.log('Teardown complete: authentication session terminated');
}

// Custom summary
export function handleSummary(data) {
  console.log('\n=== LOAD TEST SUMMARY ===');
  console.log(`Total Requests: ${data.metrics.http_reqs.value}`);
  console.log(`Total Errors: ${Math.round(data.metrics.http_req_failed.value || 0)}`);
  console.log(`P95 Duration: ${data.metrics.http_req_duration['p(95)'].toFixed(2)}ms`);
  console.log(`P99 Duration: ${data.metrics.http_req_duration['p(99)'].toFixed(2)}ms`);
  console.log(`Avg Duration: ${data.metrics.http_req_duration.value.toFixed(2)}ms`);
  console.log('========================\n');

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
  };
}

// Helper: text summary
function textSummary(data, options = {}) {
  const indent = options.indent || '';
  let summary = '\n';

  summary += `${indent}Requests: ${data.metrics.http_reqs.value}\n`;
  summary += `${indent}Errors: ${Math.round(data.metrics.http_req_failed.value || 0)}\n`;
  summary += `${indent}Duration (p50): ${data.metrics.http_req_duration['p(50)'].toFixed(2)}ms\n`;
  summary += `${indent}Duration (p95): ${data.metrics.http_req_duration['p(95)'].toFixed(2)}ms\n`;
  summary += `${indent}Duration (p99): ${data.metrics.http_req_duration['p(99)'].toFixed(2)}ms\n`;

  return summary;
}
