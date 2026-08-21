# 🔥 Load Testing Guide - 500-600 Concurrent Submissions

This guide explains how to simulate heavy load testing with 500-600 concurrent form submissions.

---

## What This Tests

The load test simulates:
- **500-600 concurrent users** opening your form at the same time
- **Each user filling and submitting** the form multiple times
- **Real-world pressure** on your backend (Supabase, RPC functions, triggers)
- **Performance metrics** like response times, success rates, bottlenecks

## Quick Start

### Run Basic Load Test (100 users × 5 submissions = 500 submissions)

```bash
cd d:\ITHub\ith-forms
node scripts/load-test.mjs
```

**Estimated Duration:** 2-5 minutes

### Run Heavy Load Test (600 users = 3000 submissions)

Edit `scripts/load-test.mjs` and change:
```javascript
const CONCURRENT_USERS = 600;        // Changed from 100
const SUBMISSIONS_PER_USER = 5;      // Keep at 5
// Total: 600 × 5 = 3000 submissions
```

Then run:
```bash
node scripts/load-test.mjs
```

**Estimated Duration:** 10-20 minutes

---

## Understanding the Results

### Sample Output

```
======================================================================
📊 LOAD TEST RESULTS
======================================================================

⏱️  Total Time: 145.23s

📈 Total Requests: 500
✅ Successful: 498 (99.60%)
❌ Failed: 2

⚡ Requests/Second: 3.44

📊 Response Time Statistics:
   • Min: 245ms
   • Max: 8920ms
   • Average: 1245.67ms
   • Median: 892ms
   • P95: 5234ms
   • P99: 7845ms

❌ Error Breakdown:
   • timeout: 1
   • form_full: 1
```

### What These Metrics Mean

| Metric | Target | What It Means |
|--------|--------|--------------|
| Success Rate | >95% | Most submissions succeeded |
| Avg Response Time | <2000ms | Average response time |
| P95 Response Time | <5000ms | 95% of requests faster than this |
| P99 Response Time | <10000ms | 99% of requests faster than this |
| Requests/Second | >5 | Can handle 5+ requests per second |

### Performance Ratings

```
99%+ success rate     → ✅ Excellent
95-99% success rate   → ⚠️  Good but some timeouts
90-95% success rate   → ⚠️  Concerning, needs optimization
<90% success rate     → ❌ Major issues, fix before production
```

---

## Load Test Levels

### Level 1: Baseline (100 users, 5 submissions each = 500 total)

```bash
# Default configuration - good for initial testing
node scripts/load-test.mjs
```

**What to expect:**
- Takes 2-5 minutes
- ~99% success rate
- Average response time: 800-1500ms

### Level 2: Medium Load (250 users, 5 submissions each = 1250 total)

```javascript
// Edit scripts/load-test.mjs
const CONCURRENT_USERS = 250;
const SUBMISSIONS_PER_USER = 5;
```

**What to expect:**
- Takes 5-10 minutes
- ~95-99% success rate
- Average response time: 1200-2500ms

### Level 3: Heavy Load (500 users, 5 submissions each = 2500 total)

```javascript
// Edit scripts/load-test.mjs
const CONCURRENT_USERS = 500;
const SUBMISSIONS_PER_USER = 5;
```

**What to expect:**
- Takes 10-15 minutes
- ~90-98% success rate
- Average response time: 2000-5000ms

### Level 4: Extreme Load (600 users, 5 submissions each = 3000 total)

```javascript
// Edit scripts/load-test.mjs
const CONCURRENT_USERS = 600;
const SUBMISSIONS_PER_USER = 5;
```

**What to expect:**
- Takes 15-25 minutes
- ~85-95% success rate
- Average response time: 3000-8000ms

---

## How to Run

### Step 1: Choose Load Level

Decide which level to test:
- Start with Level 1 (easiest)
- Progress to higher levels after success

### Step 2: Edit Configuration (Optional)

```bash
# Open the script
code scripts/load-test.mjs

# Find and edit:
const CONCURRENT_USERS = 100;        # Change this
const SUBMISSIONS_PER_USER = 5;      # Or this
```

### Step 3: Run the Test

```bash
cd d:\ITHub\ith-forms
node scripts/load-test.mjs
```

### Step 4: Monitor Progress

The script shows real-time progress:
```
[250/500] ✅ Submissions completed (248/500 success)
[300/500] ⚠️  (298/500 success, 2 failed)
[500/500] ✅ Complete!
```

### Step 5: Analyze Results

After completion, review:
- Success rate
- Response times
- Error messages
- Performance metrics

---

## What Gets Tested

### Database Operations

✅ **submit_response() RPC function**
- Idempotency handling
- Form validation
- Reference ID generation
- Token generation

✅ **submission_answers insertion**
- Multiple answers per submission
- Data integrity
- Foreign key constraints

✅ **form response_count increment**
- Atomic counter updates
- Race condition handling

### Performance Under Pressure

✅ **Connection pooling**
- How many concurrent connections Supabase handles
- Connection timeout behavior

✅ **Query performance**
- RPC execution time under load
- Database lock contention
- Index effectiveness

✅ **Rate limiting**
- Supabase rate limits
- Auth token limits
- API quota

### Reliability

✅ **Error recovery**
- Timeout handling
- Retry logic
- Error messages

✅ **Data consistency**
- No duplicate submissions
- Reference IDs are unique
- Answer data intact

---

## Interpreting Errors

### Error: "form_full"
**Meaning:** Form has a response limit and is now full
**Fix:** Clear test data or increase form's max_responses

### Error: "form_unavailable"
**Meaning:** Form status is not 'published'
**Fix:** Make sure form is in published status

### Error: "timeout"
**Meaning:** Request took too long (>30 seconds)
**Likely cause:** Server overloaded or network slow
**Fix:** 
- Reduce CONCURRENT_USERS
- Increase BATCH_SIZE
- Check server status

### Error: "unauthorized"
**Meaning:** Authentication failed
**Likely cause:** Invalid API key or expired token
**Fix:** Verify SUPABASE_ANON_KEY in script

### Error: "Connection refused"
**Meaning:** Cannot reach Supabase
**Likely cause:** Network issue or Supabase down
**Fix:** 
- Check internet connection
- Verify SUPABASE_URL
- Check Supabase status page

---

## Performance Optimization Tips

If you're seeing high error rates or slow responses:

### 1. Adjust Batch Size

The script processes 50 requests at a time. If server gets overwhelmed:

```javascript
const BATCH_SIZE = 25;  // Reduce from 50 to 25
// Or increase for better throughput:
const BATCH_SIZE = 100; // If server can handle it
```

### 2. Add Delay Between Batches

```javascript
// Increase from 500ms to 1000ms
await new Promise(resolve => setTimeout(resolve, 1000));
```

### 3. Reduce Concurrent Users

```javascript
const CONCURRENT_USERS = 50;  // Start smaller, increase gradually
```

### 4. Check Database Limits

In Supabase dashboard:
- Go to **Settings** → **Database**
- Check connection limits
- Review performance metrics
- Look for slow queries

### 5. Optimize RPC Function

Check if `submit_response()` can be optimized:
- Add missing indexes
- Reduce unnecessary queries
- Batch operations

---

## Real-World Simulation

The test mimics real users by:

✅ **Realistic names and emails**
- Mix of common first/last names
- Test email format (load.test.{id}.{index}@test.com)

✅ **Varied answers**
- Random experience levels (0-20 years)
- Different fitness reasons
- Realistic text responses

✅ **Sequential timing**
- 500ms delay between batches (simulates server recovery)
- Realistic request distribution
- Natural network latency

✅ **Idempotent submissions**
- Each request has unique idempotency_key
- Tests duplicate detection

---

## Before Production Deployment

Run through this checklist:

- [ ] ✅ Baseline test passes (Level 1: 100 users)
- [ ] ✅ Medium load test passes (Level 2: 250 users)
- [ ] ✅ Heavy load test passes (Level 3: 500 users)
- [ ] ✅ Response times acceptable
- [ ] ✅ Success rate >95%
- [ ] ✅ No data corruption
- [ ] ✅ Recovery after spikes
- [ ] ✅ Database indexes in place
- [ ] ✅ RLS policies working
- [ ] ✅ Error handling tested

---

## Post-Test Analysis

### Check Data Integrity

```sql
-- Count total submissions created during test
SELECT COUNT(*) as total_submissions
FROM public.submissions
WHERE respondent_email LIKE 'load.test.%@test.com';

-- Check for duplicates
SELECT reference_id, COUNT(*) as count
FROM public.submissions
WHERE respondent_email LIKE 'load.test.%@test.com'
GROUP BY reference_id
HAVING COUNT(*) > 1;

-- Verify answers were stored
SELECT COUNT(*) as total_answers
FROM public.submission_answers sa
JOIN public.submissions s ON sa.submission_id = s.id
WHERE s.respondent_email LIKE 'load.test.%@test.com';
```

### Check Performance

```sql
-- Check average response times by hour
SELECT 
  DATE_TRUNC('minute', submitted_at) as minute,
  COUNT(*) as submissions
FROM public.submissions
WHERE respondent_email LIKE 'load.test.%@test.com'
GROUP BY minute
ORDER BY minute DESC;
```

### Clean Up Test Data

```sql
-- Delete all test submissions
DELETE FROM public.submission_answers sa
WHERE sa.submission_id IN (
  SELECT id FROM public.submissions
  WHERE respondent_email LIKE 'load.test.%@test.com'
);

DELETE FROM public.submissions
WHERE respondent_email LIKE 'load.test.%@test.com';

-- Reset form response count
UPDATE public.forms SET response_count = 50 WHERE slug = 'job-applications';
```

---

## Troubleshooting

### Script won't run
```bash
# Make sure Node.js 18+ installed
node --version

# If error, install dependencies
npm install
```

### Getting "Cannot find form"
```javascript
// Verify form slug is correct
const FORM_SLUG = 'job-applications';
// Check in Supabase: Forms table, slug column
```

### All requests timing out
```
1. Check internet connection
2. Verify Supabase is running: https://status.supabase.com
3. Reduce CONCURRENT_USERS to 50
4. Increase REQUEST_TIMEOUT to 60000
```

### High error rate
```
1. Check Supabase logs for errors
2. Verify form is published
3. Check response_count limit
4. Review RPC function for bugs
```

---

## Advanced Testing

### Custom Load Patterns

You can modify the script to test:

```javascript
// Ramp-up: Gradually increase users
for (let users = 50; users <= 500; users += 50) {
  CONCURRENT_USERS = users;
  await runLoadTest();
}

// Spike: Sudden traffic spike
CONCURRENT_USERS = 500;  // Sudden jump
await runLoadTest();

// Sustain: Constant high load for duration
// Let test run for 10+ minutes
```

### Stress Testing

Push the system to breaking point:

```javascript
const CONCURRENT_USERS = 1000;        // Beyond expected peak
const SUBMISSIONS_PER_USER = 10;
const BATCH_SIZE = 200;               // Large batches
```

---

## Summary

✅ **Load testing helps you:**
- Find performance bottlenecks
- Verify system stability
- Ensure data integrity under pressure
- Test error handling
- Optimize for scale

✅ **Next steps:**
1. Run Level 1 test (100 users)
2. Analyze results
3. Fix any issues
4. Progress to Level 2-4
5. Deploy with confidence

---

**Status:** Ready for testing ✅
**Estimated time to run:** 2-25 minutes depending on level
**Complexity:** Low - just run the script

