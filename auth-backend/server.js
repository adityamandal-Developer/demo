const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
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
  accessTokenExpiry: '10s',
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
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      user: { id: user.id, username: user.username, email: user.email },
      accessToken
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

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ accessToken });
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

app.post('/api/logout', (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  const tokenIndex = refreshTokens.indexOf(refreshToken);
  if (tokenIndex > -1) {
    refreshTokens.splice(tokenIndex, 1);
  }

  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

