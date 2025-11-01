import React, { useState, useEffect } from 'react';
import axios from 'axios';

axios.defaults.withCredentials = true;

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [protectedData, setProtectedData] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      await fetchProtectedData();
    } catch (error) {
      setIsLoggedIn(false);
      setUser(null);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await axios.post('/api/login', formData);
      
      const { accessToken, user: userData } = response.data;
      localStorage.setItem('accessToken', accessToken);
      
      setUser(userData);
      setIsLoggedIn(true);
      setMessage('Login successful!');
      setFormData({ username: '', password: '' });
    } catch (error) {
      setMessage(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      setIsLoggedIn(false);
      setUser(null);
      setProtectedData(null);
      setMessage('Logged out successfully');
    }
  };

  const fetchProtectedData = async () => {
    let accessToken = localStorage.getItem('accessToken');
    
    try {
      const response = await axios.get('/api/protected', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      
      setProtectedData(response.data);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        try {
          const refreshResponse = await axios.post('/api/refresh-token');
          const newAccessToken = refreshResponse.data.accessToken;
          localStorage.setItem('accessToken', newAccessToken);
          
          const retryResponse = await axios.get('/api/protected', {
            headers: {
              Authorization: `Bearer ${newAccessToken}`
            }
          });
          
          setProtectedData(retryResponse.data);
          setMessage('Token refreshed automatically!');
          return retryResponse.data;
        } catch (refreshError) {    
          setIsLoggedIn(false);
          setUser(null);
          setMessage('Session expired. Please login again.');
          throw refreshError;
        }
      }
      throw error;
    }
  };

  const handleFetchData = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      await fetchProtectedData();
      setMessage('Data fetched successfully!');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Authentication Demo</h1>
      
      {message && (
        <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {!isLoggedIn ? (
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              required
              placeholder="Enter 'demo'"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              placeholder="Enter 'password'"
            />
          </div>
          
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      ) : (
        <div>
          <div className="user-info">
            <h3>Welcome, {user?.username}!</h3>
            <p>Email: {user?.email}</p>
          </div>

          <div className="form-group">
            <button onClick={handleFetchData} disabled={loading}>
              {loading ? 'Fetching...' : 'Fetch Protected Data'}
            </button>
          </div>

          {protectedData && (
            <div className="protected-data">
              <h4>Protected Data:</h4>
              <p>{protectedData.message}</p>
              <pre>{JSON.stringify(protectedData, null, 2)}</pre>
            </div>
          )}

          <button onClick={handleLogout} style={{ backgroundColor: '#dc3545' }}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default App;

