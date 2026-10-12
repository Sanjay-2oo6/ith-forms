#!/usr/bin/env node

/**
 * Test Razorpay order creation via backend API
 * This tests the /api/razorpay/create-order endpoint
 */

const API_URL = 'https://ithforms.innotechhub.in/api/razorpay/create-order';

const testPayload = {
  amount: 10000, // ₹100 in paise
  currency: 'INR',
  formId: '991023b1-3990-41b4-b96a-9040dc2d6103',
  questionId: 'f2a78212-df6a-41b2-9987-95f0a0c5dbb5',
  userEmail: 'test@example.com',
};

console.log('[Test] Testing Razorpay order creation...');
console.log('[Test] Payload:', JSON.stringify(testPayload, null, 2));
console.log('[Test] Calling:', API_URL);
console.log('');

try {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(testPayload),
  });

  console.log('[Test] Response status:', response.status);
  console.log('[Test] Response headers:', Object.fromEntries(response.headers.entries()));
  console.log('');

  const data = await response.json();
  console.log('[Test] Response body:');
  console.log(JSON.stringify(data, null, 2));
  console.log('');

  if (response.ok) {
    console.log('✅ SUCCESS! Order created successfully');
    console.log('Order ID:', data.orderId);
    console.log('Amount:', data.amount, 'paise (₹' + (data.amount / 100) + ')');
    console.log('Currency:', data.currency);
  } else {
    console.error('❌ FAILED! Order creation failed');
    console.error('Error:', data.message || 'Unknown error');
  }
} catch (error) {
  console.error('❌ NETWORK ERROR:', error.message);
  console.error('Full error:', error);
}
