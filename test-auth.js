const axios = require('axios');

const API_URL = 'http://localhost:8800';

async function testAuth() {
  console.log('🧪 Testing Authentication System...\n');

  try {
    // Test 1: Register a new user
    console.log('1️⃣ Testing user registration...');
    const registerData = {
      email: 'user@gmail.com',
      password: 'SecurePass123!',
      name: 'John Doe',
    };

    const registerResponse = await axios.post(`${API_URL}/auth/register`, registerData);
    console.log('✅ Registration successful');
    console.log('User:', registerResponse.data.user);
    console.log('Access Token:', registerResponse.data.accessToken ? '✅ Present' : '❌ Missing');
    console.log('Refresh Token:', registerResponse.data.refreshToken ? '✅ Present' : '❌ Missing');

    const { accessToken, refreshToken } = registerResponse.data;

    // Test 2: Login with the same user
    console.log('\n2️⃣ Testing user login...');
    const loginData = {
      email: 'user@gmail.com',
      password: 'SecurePass123!',
    };

    const loginResponse = await axios.post(`${API_URL}/auth/login`, loginData);
    console.log('✅ Login successful');
    console.log('User:', loginResponse.data.user);

    // Test 3: Access protected route
    console.log('\n3️⃣ Testing protected route access...');
    const profileResponse = await axios.get(`${API_URL}/auth/profile`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    console.log('✅ Protected route access successful');
    console.log('Profile:', profileResponse.data);

    // Test 4: Token refresh
    console.log('\n4️⃣ Testing token refresh...');
    const refreshResponse = await axios.post(`${API_URL}/auth/refresh`, {
      refreshToken: refreshToken,
    });
    console.log('✅ Token refresh successful');
    console.log(
      'New Access Token:',
      refreshResponse.data.accessToken ? '✅ Present' : '❌ Missing'
    );

    // Test 5: Test disposable email rejection
    console.log('\n5️⃣ Testing disposable email rejection...');
    try {
      await axios.post(`${API_URL}/auth/register`, {
        email: 'test@10minutemail.com',
        password: 'SecurePass123!',
        name: 'Spam User',
      });
      console.log('❌ Disposable email was accepted (should be rejected)');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Disposable email correctly rejected');
        console.log('Error message:', error.response.data.message);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    // Test 6: Test weak password rejection
    console.log('\n6️⃣ Testing weak password rejection...');
    try {
      await axios.post(`${API_URL}/auth/register`, {
        email: 'weak@gmail.com',
        password: 'weak',
        name: 'Jane Smith',
      });
      console.log('❌ Weak password was accepted (should be rejected)');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Weak password correctly rejected');
        console.log('Error message:', error.response.data.message);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    console.log('\n🎉 All authentication tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testAuth();
