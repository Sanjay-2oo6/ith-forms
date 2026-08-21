#!/usr/bin/env node

/**
 * Load Testing Script - Simulate 500-600 Concurrent Form Submissions
 * 
 * This script tests the form submission endpoint under heavy load by:
 * - Creating multiple concurrent submission requests
 * - Measuring response times
 * - Tracking success/failure rates
 * - Detecting performance bottlenecks
 * 
 * Run with: node scripts/load-test.mjs
 * 
 * Configuration:
 * - CONCURRENT_USERS: Number of simultaneous users
 * - SUBMISSIONS_PER_USER: How many times each user submits
 * - FORM_SLUG: Which form to test
 */

import { randomUUID } from 'crypto';
import https from 'https';

// ============================================================
// CONFIGURATION
// ============================================================

const SUPABASE_URL = 'https://zkaeourngxwykkhapotj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprYWVvdXJuZ3h3eWtraGFwb3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNjg4MDEsImV4cCI6MjEwMDc0NDgwMX0.73H3JRqvojytktdNdI1T7w13Pg7f5mcEClNw8daQnCs';
const FORM_SLUG = 'job-applications';

// Load test parameters
const CONCURRENT_USERS = 100;        // Start with 100 users
const SUBMISSIONS_PER_USER = 1;      // Each user submits 1 time = 100 total (no files since they're test-only)
const REQUEST_TIMEOUT = 30000;       // 30 second timeout per request

// ⚠️ NOTE: These load test submissions DO NOT include file uploads since that requires actual File objects
// They test the concurrent submission pipeline ONLY. For real submissions with files, use the form UI.

// Sample data
const FIRST_NAMES = [
  'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'Robert', 'Lisa', 'James', 'Maria',
  'William', 'Jennifer', 'Richard', 'Linda', 'Joseph', 'Patricia', 'Thomas', 'Barbara'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson'
];

const FIT_REASONS = [
  'Strong technical background with proven skills',
  'Experience perfectly matches requirements',
  'Passionate about continuous learning',
  'Brings innovation and fresh ideas',
  'Demonstrated leadership abilities'
];

const EXPERIENCE_LEVELS = [0, 1, 2, 3, 5, 7, 10, 15, 20];

// ============================================================
// STATISTICS
// ============================================================

class LoadTestStats {
  constructor() {
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.responseTimes = [];
    this.errors = {};
    this.startTime = Date.now();
  }

  addResponse(duration, success, error = null) {
    this.totalRequests++;
    this.responseTimes.push(duration);
    
    if (success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
      const errorKey = error || 'Unknown';
      this.errors[errorKey] = (this.errors[errorKey] || 0) + 1;
    }
  }

  getStats() {
    const sorted = this.responseTimes.sort((a, b) => a - b);
    const len = sorted.length;
    
    return {
      totalTime: Date.now() - this.startTime,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      successRate: ((this.successfulRequests / this.totalRequests) * 100).toFixed(2),
      avgResponseTime: (sorted.reduce((a, b) => a + b, 0) / len).toFixed(2),
      minResponseTime: sorted[0],
      maxResponseTime: sorted[len - 1],
      medianResponseTime: sorted[Math.floor(len / 2)],
      p95ResponseTime: sorted[Math.floor(len * 0.95)],
      p99ResponseTime: sorted[Math.floor(len * 0.99)],
      requestsPerSecond: (this.totalRequests / (this.totalTime / 1000)).toFixed(2),
      errors: this.errors
    };
  }

  print() {
    const stats = this.getStats();
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 LOAD TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`\n⏱️  Total Time: ${(stats.totalTime / 1000).toFixed(2)}s`);
    console.log(`📈 Total Requests: ${stats.totalRequests}`);
    console.log(`✅ Successful: ${stats.successfulRequests} (${stats.successRate}%)`);
    console.log(`❌ Failed: ${stats.failedRequests}`);
    console.log(`\n⚡ Requests/Second: ${stats.requestsPerSecond}`);
    console.log(`\n📊 Response Time Statistics:`);
    console.log(`   • Min: ${stats.minResponseTime}ms`);
    console.log(`   • Max: ${stats.maxResponseTime}ms`);
    console.log(`   • Average: ${stats.avgResponseTime}ms`);
    console.log(`   • Median: ${stats.medianResponseTime}ms`);
    console.log(`   • P95: ${stats.p95ResponseTime}ms`);
    console.log(`   • P99: ${stats.p99ResponseTime}ms`);
    
    if (Object.keys(stats.errors).length > 0) {
      console.log(`\n❌ Error Breakdown:`);
      Object.entries(stats.errors).forEach(([error, count]) => {
        console.log(`   • ${error}: ${count}`);
      });
    }
    
    console.log('\n' + '='.repeat(70));
  }
}

// ============================================================
// UTILITIES
// ============================================================

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'zkaeourngxwykkhapotj.supabase.co',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      timeout: REQUEST_TIMEOUT
    };

    const startTime = Date.now();
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const duration = Date.now() - startTime;
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject({ 
              statusCode: res.statusCode, 
              error: parsed.message || parsed.error_description || 'Unknown error',
              duration 
            });
          } else {
            resolve({ data: parsed, duration });
          }
        } catch (e) {
          resolve({ data: body, duration });
        }
      });
    });

    req.on('error', (err) => {
      const duration = Date.now() - startTime;
      reject({ error: err.message, duration });
    });

    req.on('timeout', () => {
      req.destroy();
      const duration = Date.now() - startTime;
      reject({ error: 'Request timeout', duration });
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function getFormIdFromSlug() {
  const response = await makeRequest(
    'GET',
    `/rest/v1/forms?slug=eq.${FORM_SLUG}&select=id`
  );
  if (Array.isArray(response.data) && response.data.length > 0) {
    return response.data[0].id;
  }
  throw new Error(`Form with slug "${FORM_SLUG}" not found`);
}

async function getFormQuestions(formId) {
  const response = await makeRequest(
    'GET',
    `/rest/v1/form_questions?form_id=eq.${formId}&select=id,type,label`
  );
  return response.data;
}

function generateTestData(userId, submissionIndex, questions) {
  const firstName = FIRST_NAMES[userId % FIRST_NAMES.length];
  const lastName = LAST_NAMES[userId % LAST_NAMES.length];
  const email = `load.test.${userId}.${submissionIndex}@test.com`;
  
  const answers = [];
  questions.forEach((q, idx) => {
    let value = '';
    
    if (q.label.toLowerCase().includes('years') || q.label.toLowerCase().includes('experience')) {
      value = EXPERIENCE_LEVELS[Math.floor(Math.random() * EXPERIENCE_LEVELS.length)].toString();
    } else if (q.label.toLowerCase().includes('good fit') || q.label.toLowerCase().includes('why')) {
      value = FIT_REASONS[Math.floor(Math.random() * FIT_REASONS.length)];
    } else if (q.label.toLowerCase().includes('resume') || q.label.toLowerCase().includes('cv')) {
      // Skip file fields - they cannot be filled in load test without actual file upload
      // This is why some test submissions may not have all fields filled
      return;
    } else if (q.type === 'text_input' || q.type === 'text') {
      value = `Load test response ${userId}-${submissionIndex} for ${q.label}`;
    } else if (q.type === 'textarea') {
      value = `Detailed load test response ${userId}-${submissionIndex}. This is testing concurrent submissions.`;
    } else {
      value = 'Test response';
    }

    if (value) {
      answers.push({
        question_id: q.id,
        value: value
      });
    }
  });

  return {
    name: `${firstName} ${lastName}`,
    email: email,
    answers: answers
  };
}

async function submitForm(formId, questions, userId, submissionIndex) {
  const testData = generateTestData(userId, submissionIndex, questions);
  
  const payload = {
    p_form_id: formId,
    p_name: testData.name,
    p_email: testData.email,
    p_idempotency_key: randomUUID(),
    p_answers: testData.answers
  };

  return makeRequest('POST', '/rest/v1/rpc/submit_response', payload);
}

// ============================================================
// LOAD TEST ENGINE
// ============================================================

async function runLoadTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 LOAD TEST - CONCURRENT FORM SUBMISSIONS');
  console.log('='.repeat(70));
  console.log(`\n📋 Configuration:`);
  console.log(`   • Form: ${FORM_SLUG}`);
  console.log(`   • Concurrent Users: ${CONCURRENT_USERS}`);
  console.log(`   • Submissions per User: ${SUBMISSIONS_PER_USER}`);
  console.log(`   • Total Submissions: ${CONCURRENT_USERS * SUBMISSIONS_PER_USER}`);
  console.log(`   • Request Timeout: ${REQUEST_TIMEOUT}ms`);
  
  const stats = new LoadTestStats();

  try {
    console.log(`\n⏳ Fetching form data...`);
    const formId = await getFormIdFromSlug();
    const questions = await getFormQuestions(formId);
    console.log(`✅ Form ready (${questions.length} questions)`);

    console.log(`\n⏳ Starting concurrent submissions...`);
    console.log(`   (This may take a few minutes)\n`);

    // Create array of all submissions to make
    const submissions = [];
    for (let userId = 0; userId < CONCURRENT_USERS; userId++) {
      for (let subIdx = 0; subIdx < SUBMISSIONS_PER_USER; subIdx++) {
        submissions.push({ userId, subIdx });
      }
    }

    // Execute with concurrency control (batches)
    const BATCH_SIZE = 50; // Process 50 at a time to avoid overwhelming the server
    let completed = 0;

    for (let i = 0; i < submissions.length; i += BATCH_SIZE) {
      const batch = submissions.slice(i, i + BATCH_SIZE);
      
      // Execute all in batch concurrently
      const batchResults = await Promise.allSettled(
        batch.map(({ userId, subIdx }) => 
          submitForm(formId, questions, userId, subIdx)
        )
      );

      // Process results
      batchResults.forEach((result) => {
        completed++;
        if (result.status === 'fulfilled') {
          const { duration } = result.value;
          stats.addResponse(duration, true);
          process.stdout.write(`\r[${completed}/${submissions.length}] ✅ Submissions completed (${stats.successfulRequests}/${stats.totalRequests} success)`);
        } else {
          const { duration, error } = result.reason || { error: 'Unknown error' };
          stats.addResponse(duration, false, error);
          process.stdout.write(`\r[${completed}/${submissions.length}] ⚠️  (${stats.successfulRequests}/${stats.totalRequests} success, ${stats.failedRequests} failed)`);
        }
      });

      // Small delay between batches to let server recover
      if (i + BATCH_SIZE < submissions.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('\n');
    stats.print();

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// ============================================================
// ENTRY POINT
// ============================================================

console.log(`\n📊 Load Test Configuration Options:`);
console.log(`\n   To change concurrency, edit the script and modify:`);
console.log(`   - CONCURRENT_USERS: Currently ${CONCURRENT_USERS} (try 100, 250, 500)`);
console.log(`   - SUBMISSIONS_PER_USER: Currently ${SUBMISSIONS_PER_USER}`);
console.log(`   - BATCH_SIZE: Currently 50 (adjust if server gets overwhelmed)`);

runLoadTest().catch(console.error);
