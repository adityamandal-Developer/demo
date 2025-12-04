## REACT cookie
```js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

axios.defaults.withCredentials = true;

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
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
      const response = await axios.get('/api/auth/status');
      setIsLoggedIn(true);
      setUser(response.data.user);
    } catch (error) {
      setIsLoggedIn(false);
      setUser(null);
    } finally {
      setLoading(false);
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
    setActionLoading(true);
    setMessage('');

    try {
      const response = await axios.post('/api/login', formData);
      setUser(response.data.user);
      setIsLoggedIn(true);
      setMessage('Login successful!');
      setFormData({ username: '', password: '' });
    } catch (error) {
      setMessage(error.response?.data?.error || 'Login failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/logout');
      setIsLoggedIn(false);
      setUser(null);
      setProtectedData(null);
      setMessage('Logged out successfully');
    } catch (error) {
      setMessage('Logout failed');
    }
  };

  const fetchProtectedData = async () => {
    try {
      const response = await axios.get('/api/protected');
      setProtectedData(response.data);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        try {
          await axios.post('/api/refresh-token');
          const retryResponse = await axios.get('/api/protected');
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
    setActionLoading(true);
    setMessage('');
    
    try {
      await fetchProtectedData();
      setMessage('Data fetched successfully!');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to fetch data');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <h1>Authentication Demo</h1>
        <p>Checking authentication status...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Authentication Demo</h1>

      {message && (
        <div className={`message ${message.includes('success') || message.includes('refreshed') ? 'success' : 'error'}`}>
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
          
          <button type="submit" disabled={actionLoading}>
            {actionLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      ) : (
        <div>
          <div className="user-info">
            <h3>Welcome, {user?.username}!</h3>
            <p>Email: {user?.email}</p>
          </div>

          <div className="form-group">
            <button onClick={handleFetchData} disabled={actionLoading}>
              {actionLoading ? 'Fetching...' : 'Fetch Protected Data'}
            </button>
          </div>

          {protectedData && (
            <div className="protected-data">
              <h4>Protected Data:</h4>
              <p>{protectedData.message}</p>
              <pre>{JSON.stringify(protectedData, null, 2)}</pre>
            </div>
          )}

          <button onClick={handleLogout} style={{ backgroundColor: '#dc3545', marginTop: '10px' }}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default App;

```

backend cookie based 
```js
const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(passport.initialize());

const users = [
  {
    id: 1,
    username: 'demo',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    email: 'demo@example.com'
  }
];

const refreshTokens = [];

const JWT_CONFIG = {
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET || 'your-access-token-secret',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'your-refresh-token-secret',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d'
};

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, username: user.username },
    JWT_CONFIG.accessTokenSecret,
    { expiresIn: JWT_CONFIG.accessTokenExpiry }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    JWT_CONFIG.refreshTokenSecret,
    { expiresIn: JWT_CONFIG.refreshTokenExpiry }
  );

  return { accessToken, refreshToken };
};

passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      const user = users.find(u => u.username === username);
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return done(null, false, { message: 'Incorrect password.' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

const jwtOptions = {
  jwtFromRequest: (req) => req.cookies?.accessToken,
  secretOrKey: JWT_CONFIG.accessTokenSecret
};

passport.use('jwt', new JwtStrategy(jwtOptions, (payload, done) => {
  const user = users.find(u => u.id === payload.id);
  if (user) {
    return done(null, user);
  } else {
    return done(null, false);
  }
}));

const refreshJwtOptions = {
  jwtFromRequest: (req) => req.cookies?.refreshToken,
  secretOrKey: JWT_CONFIG.refreshTokenSecret
};

passport.use('jwt-refresh', new JwtStrategy(refreshJwtOptions, (payload, done) => {
  const user = users.find(u => u.id === payload.id);
  if (user) {
    return done(null, user);
  } else {
    return done(null, false);
  }
}));

app.post('/api/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(401).json({ error: info.message });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    refreshTokens.push(refreshToken);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      user: { id: user.id, username: user.username, email: user.email },
      message: 'Login successful'
    });
  })(req, res, next);
});

app.post('/api/refresh-token', (req, res, next) => {
  passport.authenticate('jwt-refresh', { session: false }, (err, user, info) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    const oldRefreshToken = req.cookies?.refreshToken;
    const oldTokenIndex = refreshTokens.indexOf(oldRefreshToken);
    if (oldTokenIndex > -1) {
      refreshTokens.splice(oldTokenIndex, 1);
    }
    refreshTokens.push(newRefreshToken);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      message: 'Token refreshed',
      user: { id: user.id, username: user.username, email: user.email }
    });
  })(req, res, next);
});

app.get('/api/protected',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    res.json({
      message: 'This is protected data!',
      user: req.user
    });
  }
);

app.get('/api/auth/status',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    res.json({
      isAuthenticated: true,
      user: { id: req.user.id, username: req.user.username, email: req.user.email }
    });
  }
);

app.post('/api/logout', (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  const tokenIndex = refreshTokens.indexOf(refreshToken);
  if (tokenIndex > -1) {
    refreshTokens.splice(tokenIndex, 1);
  }

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

```
