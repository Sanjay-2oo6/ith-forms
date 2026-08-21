#!/usr/bin/env node

/**
 * Script to create 50 test submissions for the job-applications form
 * Modern Node.js version using fetch (requires Node.js 18+)
 * Run with: node scripts/generate-test-submissions.mjs
 */

import { randomUUID } from 'crypto';

// Configuration
const SUPABASE_URL = 'https://zkaeourngxwykkhapotj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprYWVvdXJuZ3h3eWtraGFwb3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNjg4MDEsImV4cCI6MjEwMDc0NDgwMX0.73H3JRqvojytktdNdI1T7w13Pg7f5mcEClNw8daQnCs';
const FORM_SLUG = 'job-applications';
const NUM_SUBMISSIONS = 50;

// Sample data
const firstNames = [
  'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'Robert', 'Lisa', 'James', 'Maria',
  'William', 'Jennifer', 'Richard', 'Linda', 'Joseph', 'Patricia', 'Thomas', 'Barbara', 'Charles', 'Susan',
  'Christopher', 'Jessica', 'Daniel', 'Nancy', 'Matthew', 'Karen', 'Anthony', 'Lisa', 'Donald', 'Betty',
  'Mark', 'Margaret', 'Steven', 'Sandra', 'Paul', 'Ashley', 'Andrew', 'Kimberly', 'Joshua', 'Donna',
  'Kenneth', 'Carol', 'Kevin', 'Michelle', 'Brian', 'Dorothy', 'George', 'Melissa', 'Edward', 'Deborah'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Peterson', 'Phillips', 'Campbell', 'Parker',
  'Evans', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers'
];

const fitReasons = [
  'I have strong technical skills and passion for development',
  'My experience aligns perfectly with the role requirements',
  'I am committed to continuous learning and growth',
  'I bring innovation and problem-solving skills',
  'My background demonstrates leadership and collaboration',
  'I have proven expertise in this field',
  'I am eager to contribute to your team',
  'My skills match your company culture',
  'I have successful track record in similar roles',
  'I am motivated by challenging projects'
];

const experienceLevels = [0, 1, 2, 3, 5, 7, 10, 15, 20];

// Helper function to make API request
async function makeRequest(method, path, data = null) {
  const url = `${SUPABASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  const responseBody = await response.json();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(responseBody)}`);
  }

  return responseBody;
}

// Get form ID from slug
async function getFormIdFromSlug() {
  console.log(`📋 Fetching form ID for slug: "${FORM_SLUG}"...`);
  try {
    const response = await makeRequest(
      'GET',
      `/rest/v1/forms?slug=eq.${FORM_SLUG}&select=id`
    );
    if (Array.isArray(response) && response.length > 0) {
      console.log(`✅ Form ID: ${response[0].id}`);
      return response[0].id;
    }
    throw new Error(`Form with slug "${FORM_SLUG}" not found`);
  } catch (error) {
    console.error('❌ Error fetching form:', error.message);
    throw error;
  }
}

// Get form questions
async function getFormQuestions(formId) {
  console.log('📝 Fetching form questions...');
  try {
    const response = await makeRequest(
      'GET',
      `/rest/v1/form_questions?form_id=eq.${formId}&select=id,type,label`
    );
    console.log(`✅ Found ${response.length} questions`);
    return response;
  } catch (error) {
    console.error('❌ Error fetching questions:', error.message);
    throw error;
  }
}

// Submit form response via RPC
async function submitForm(formId, answers) {
  const payload = {
    p_form_id: formId,
    p_name: answers.name,
    p_email: answers.email,
    p_idempotency_key: randomUUID(),
    p_answers: answers.answers
  };

  return makeRequest('POST', '/rest/v1/rpc/submit_response', payload);
}

// Generate random test data
function generateTestData(index, questions) {
  const firstName = firstNames[index % firstNames.length];
  const lastName = lastNames[index % lastNames.length];
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@test.com`;
  
  // Build answers based on questions
  const answers = [];
  
  questions.forEach((q) => {
    let value = '';
    
    if (q.label.toLowerCase().includes('years') || q.label.toLowerCase().includes('experience')) {
      value = experienceLevels[Math.floor(Math.random() * experienceLevels.length)].toString();
    } else if (q.label.toLowerCase().includes('good fit') || q.label.toLowerCase().includes('why')) {
      value = fitReasons[Math.floor(Math.random() * fitReasons.length)];
    } else if (q.label.toLowerCase().includes('resume') || q.label.toLowerCase().includes('cv')) {
      // Skip file uploads - handled separately
      return;
    } else if (q.type === 'text_input' || q.type === 'text') {
      value = `Sample response for ${q.label} - Entry ${index}`;
    } else if (q.type === 'textarea') {
      value = `This is a detailed response for ${q.label}. Applicant #${index} is providing comprehensive information about their background and qualifications.`;
    } else if (q.type === 'single_choice' || q.type === 'radio') {
      value = 'Yes';
    } else if (q.type === 'multiple_choice' || q.type === 'checkbox') {
      value = 'Option 1||Option 2';
    } else {
      value = `Response to ${q.label}`;
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

// Delay helper
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main execution
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 TEST SUBMISSION GENERATOR');
  console.log('='.repeat(70) + '\n');
  
  try {
    // Fetch form data
    const formId = await getFormIdFromSlug();
    const questions = await getFormQuestions(formId);

    console.log('\n' + '='.repeat(70));
    console.log(`📨 SUBMITTING ${NUM_SUBMISSIONS} TEST REGISTRATIONS`);
    console.log('='.repeat(70) + '\n');

    let successCount = 0;
    let errorCount = 0;
    const results = [];

    for (let i = 1; i <= NUM_SUBMISSIONS; i++) {
      try {
        const testData = generateTestData(i, questions);
        const result = await submitForm(formId, testData);

        successCount++;
        const refId = result.reference_id || 'N/A';
        const progressBar = `[${String(i).padStart(2, '0')}/${NUM_SUBMISSIONS}]`;
        console.log(`${progressBar} ✅ ${testData.name.padEnd(25)} → Ref: ${refId}`);
        
        results.push({
          name: testData.name,
          email: testData.email,
          refId: refId,
          success: true
        });

        // Small delay to avoid rate limiting
        await delay(150);
      } catch (error) {
        errorCount++;
        const progressBar = `[${String(i).padStart(2, '0')}/${NUM_SUBMISSIONS}]`;
        console.log(`${progressBar} ❌ Error: ${error.message.substring(0, 50)}`);
        
        results.push({
          success: false,
          error: error.message
        });

        // Small delay before retry
        await delay(150);
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Successful submissions: ${successCount} / ${NUM_SUBMISSIONS}`);
    console.log(`❌ Failed submissions: ${errorCount} / ${NUM_SUBMISSIONS}`);
    console.log(`📈 Success rate: ${((successCount / NUM_SUBMISSIONS) * 100).toFixed(1)}%`);
    console.log('='.repeat(70));
    
    if (successCount > 0) {
      console.log('\n✨ Sample submissions created:');
      results
        .filter(r => r.success)
        .slice(0, 5)
        .forEach(r => {
          console.log(`   • ${r.name} (${r.email}) - Ref: ${r.refId}`);
        });
      if (successCount > 5) {
        console.log(`   ... and ${successCount - 5} more`);
      }
    }

    console.log('\n🎉 Test data generation complete!');
    console.log('📊 Check your admin dashboard at: https://ith-form.netlify.app/admin/dashboard');
    console.log('   Navigate to "Responses" to view all submissions.\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
