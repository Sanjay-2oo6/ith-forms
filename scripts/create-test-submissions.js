#!/usr/bin/env node

/**
 * Script to create 50 test submissions for the job-applications form
 * Run with: node scripts/create-test-submissions.js
 */

const https = require('https');
const { v4: uuidv4 } = require('uuid');

// Configuration
const SUPABASE_URL = 'https://zkaeourngxwykkhapotj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprYWVvdXJuZ3h3eWtraGFwb3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNjg4MDEsImV4cCI6MjEwMDc0NDgwMX0.73H3JRqvojytktdNdI1T7w13Pg7f5mcEClNw8daQnCs';
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

const companies = [
  'Tech Corp', 'Global Solutions', 'Innovation Labs', 'Digital Ventures', 'Cloud Systems',
  'Data Insights', 'Software House', 'Tech Innovations', 'Future Tech', 'Smart Solutions'
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

// Helper function to make HTTPS request
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'zkaeourngxwykkhapotj.supabase.co',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Get form ID from slug
async function getFormIdFromSlug() {
  try {
    const response = await makeRequest(
      'GET',
      `/rest/v1/forms?slug=eq.${FORM_SLUG}&select=id`
    );
    if (Array.isArray(response) && response.length > 0) {
      return response[0].id;
    }
    throw new Error(`Form with slug "${FORM_SLUG}" not found`);
  } catch (error) {
    console.error('Error fetching form ID:', error.message);
    throw error;
  }
}

// Get form questions and sections
async function getFormQuestions(formId) {
  try {
    const response = await makeRequest(
      'GET',
      `/rest/v1/form_questions?form_id=eq.${formId}&select=id,type,label,section_id`
    );
    return response;
  } catch (error) {
    console.error('Error fetching questions:', error.message);
    throw error;
  }
}

// Submit form response
async function submitForm(formId, answers) {
  try {
    const payload = {
      p_form_id: formId,
      p_name: answers.name,
      p_email: answers.email,
      p_idempotency_key: uuidv4(),
      p_answers: answers.answers
    };

    const response = await makeRequest(
      'POST',
      '/rest/v1/rpc/submit_response',
      payload
    );

    return response;
  } catch (error) {
    console.error('Error submitting form:', error.message);
    throw error;
  }
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
    
    if (q.label.toLowerCase().includes('years')) {
      value = experienceLevels[Math.floor(Math.random() * experienceLevels.length)].toString();
    } else if (q.label.toLowerCase().includes('good fit') || q.label.toLowerCase().includes('why')) {
      value = fitReasons[Math.floor(Math.random() * fitReasons.length)];
    } else if (q.label.toLowerCase().includes('resume') || q.label.toLowerCase().includes('cv')) {
      value = ''; // File uploads handled separately
    } else if (q.type === 'text_input') {
      value = `Sample response for ${q.label} - Entry ${index}`;
    } else if (q.type === 'textarea') {
      value = `This is a detailed response for ${q.label}. Applicant #${index} is providing comprehensive information.`;
    } else if (q.type === 'single_choice' || q.type === 'radio') {
      value = 'Yes';
    } else if (q.type === 'multiple_choice' || q.type === 'checkbox') {
      value = 'Option 1||Option 2';
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

// Main execution
async function main() {
  console.log('🚀 Starting test submission generator...\n');
  
  try {
    console.log(`📋 Getting form ID for slug: "${FORM_SLUG}"...`);
    const formId = await getFormIdFromSlug();
    console.log(`✅ Form ID: ${formId}\n`);

    console.log('📝 Fetching form questions...');
    const questions = await getFormQuestions(formId);
    console.log(`✅ Found ${questions.length} questions\n`);

    let successCount = 0;
    let errorCount = 0;

    console.log(`📨 Submitting ${NUM_SUBMISSIONS} test registrations...\n`);

    for (let i = 1; i <= NUM_SUBMISSIONS; i++) {
      try {
        const testData = generateTestData(i, questions);
        const result = await submitForm(formId, testData);

        successCount++;
        const progress = `[${i}/${NUM_SUBMISSIONS}]`;
        const refId = result.reference_id || 'N/A';
        console.log(`${progress} ✅ ${testData.name} (${testData.email}) → Ref: ${refId}`);

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        errorCount++;
        console.log(`[${i}/${NUM_SUBMISSIONS}] ❌ Error: ${error.message}`);
        // Continue with next submission
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Successful submissions: ${successCount}`);
    console.log(`❌ Failed submissions: ${errorCount}`);
    console.log(`📈 Success rate: ${((successCount / NUM_SUBMISSIONS) * 100).toFixed(1)}%`);
    console.log('='.repeat(70));
    console.log('\n🎉 Test data generation complete!');
    console.log('📊 Check your admin dashboard to view the responses.');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
