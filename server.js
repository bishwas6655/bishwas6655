// Load environment variables from .env
require('dotenv').config();

// Import packages
const express  = require('express');
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');      // we need bcrypt for password hashing
const User     = require('./models/user'); // your Mongoose User model
const path     = require('path');       // for serving static files
// App initialization
const app  = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware (for parsing JSON data)
app.use(express.json());


// Serve static assets, but override the default index file:
app.use(express.static(path.join(__dirname, 'public'), {
  index: 'landingpage.html'
}));


// MongoDB Connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser:    true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ DB connection failed:", err));

// REGISTER
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, phone, services, state } = req.body;
    const user = new User({ fullName: name, email, password, phone, services, state });
    await user.save();
    res.status(201).json({ success: true, message: 'User registered' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    // TODO: issue a session or JWT here
    res.json({ success: true, message: 'Logged in' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Default route
app.get('/', (req, res) => res.send('🚀 Careerscopes.online is live!'));

// Start the server
app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
});
