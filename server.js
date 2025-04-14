// Load environment variables from .env
require('dotenv').config();

// Import packages
const express = require('express');
const mongoose = require('mongoose');

// App initialization
const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware (for parsing JSON data)
app.use(express.json());

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("✅ MongoDB connected successfully");
})
.catch((error) => {
  console.error("❌ DB connection failed:", error);
});
const User = require('./models/user.js');
// Test insert
const testUser = new User({
  fullName: 'Bishwas Bhandari',
  email: 'bishwas@example.com',
  password: 'test1234'
});

testUser.save()
  .then(() => console.log('✅ Test user saved to DB'))
  .catch(err => console.error('❌ Error saving user:', err));


// Default Route
app.get('/', (req, res) => {
  res.send('🚀 Careerscopes.online is live!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`🌐 Server running at: http://localhost:${PORT}`);
});
