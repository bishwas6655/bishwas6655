// Load environment variables from .env
require('dotenv').config();

// Import packages
const express  = require('express');
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');      // we need bcrypt for password hashing
const User     = require('./models/user'); // your Mongoose User model
const path     = require('path');       // for serving static files
const Contact = require('./models/Contact');
const fs      = require('fs');
const multer  = require('multer');
const sanitizeHtml = require('sanitize-html');
const Page = require('./models/Page');



// App initialization
const app  = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware (for parsing JSON data)
app.use(express.json());
// Middleware to parse URL-encoded data (e.g., from forms)
app.use(express.urlencoded({ extended: true }));
// PATCH /api/profile/field
// ===== CMS API (inline) =====
const ADMIN_TOKEN = process.env.CMS_ADMIN_TOKEN || ''; // set in .env

function requireAdmin(req, res, next) {
  const h = req.headers.authorization || '';
  const bearer = h.startsWith('Bearer ') ? h.slice(7) : '';
  const token = bearer || req.get('x-admin-token') || '';
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

const CLEAN = (html) => sanitizeHtml(String(html), {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'h1','h2','h3','h4','br','span','ul','ol','li','strong','em'
  ]),
  allowedAttributes: { a: ['href','target','rel'], '*': ['class'] },
  transformTags: {
    a: (tag, attrs) => {
      if (attrs.target === '_blank') attrs.rel = 'noopener noreferrer';
      return { tagName: 'a', attribs: attrs };
    }
  }
});

// Public: used by /public/js/cms.js
app.get('/api/pages/:slug', async (req, res) => {
  try {
    const slug = (req.params.slug || '').trim();
    const page = await Page.findOne({ slug });
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    if (!page) return res.json({ slug, sections: {} });
    res.json({ slug: page.slug, sections: Object.fromEntries(page.sections) });
  } catch (e) {
    console.error('GET /api/pages error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create empty page
app.post('/api/pages', requireAdmin, async (req, res) => {
  try {
    const slug = (req.body?.slug || '').trim();
    if (!slug) return res.status(400).json({ error: 'slug required' });
    const exists = await Page.findOne({ slug });
    if (exists) return res.status(409).json({ error: 'slug exists' });
    await Page.create({ slug, sections: {} });
    res.status(201).json({ ok: true, slug });
  } catch (e) {
    console.error('POST /api/pages error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: upsert sections for a slug
app.put('/api/pages/:slug', requireAdmin, async (req, res) => {
  try {
    const slug = (req.params.slug || '').trim();
    const incoming = req.body?.sections || {};
    const cleaned = {};
    for (const [k, v] of Object.entries(incoming)) cleaned[k] = CLEAN(v);

    const page = await Page.findOneAndUpdate(
      { slug },
      { $set: { sections: cleaned, updatedAt: new Date() } },
      { upsert: true, new: true }
    );
    res.json({ ok: true, slug: page.slug, updatedAt: page.updatedAt });
  } catch (e) {
    console.error('PUT /api/pages error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: delete page
app.delete('/api/pages/:slug', requireAdmin, async (req, res) => {
  try {
    await Page.deleteOne({ slug: (req.params.slug || '').trim() });
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/pages error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});
// ===== end CMS API =====
// If not already imported near the top:


// 1) Messages table (Admin → View Messages)
app.get('/api/contacts', async (req, res) => {
  try {
    const items = await Contact.find().sort({ _id: -1 }); // newest first
    res.json(items);
  } catch (e) {
    console.error('GET /api/contacts', e);
    res.status(500).json([]);
  }
});

// 2) Users table (Admin → View Users)
app.get('/api/users', async (req, res) => {
  try {
    const items = await User.find({}, { password: 0 }).sort({ _id: -1 });
    res.json(items);
  } catch (e) {
    console.error('GET /api/users', e);
    res.status(500).json([]);
  }
});

// 3) Page list for the dropdown (Admin → Edit Pages)
// Uses the same requireAdmin() you added for the CMS API. If you skipped auth, remove it.
app.get('/api/admin/pages', /* requireAdmin, */ async (req, res) => {
  try {
    const items = await Page.find({}, { slug: 1, updatedAt: 1, _id: 0 }).sort({ slug: 1 });
    res.json(items);
  } catch (e) {
    console.error('GET /api/admin/pages', e);
    res.status(500).json([]);
  }
});


// body: { email, section, action, value?, index? }
// sections: qualifications | workExperience | skills | licenses | additionalInfo
app.patch('/api/profile/field', async (req, res) => {
  try {
    const { email, section, action, value, index } = req.body || {};
    if (!email || !section || !action)
      return res.status(400).json({ success:false, message:'email, section, action required' });

    const arraySections = ['qualifications','workExperience','skills','licenses'];

    if (section === 'additionalInfo') {
      if (action !== 'set') return res.status(400).json({ success:false, message:'additionalInfo only supports action=set' });
      await User.updateOne({ email }, { $set: { 'questionnaire.additionalInfo': value || '' } });
      return res.json({ success:true });
    }

    if (!arraySections.includes(section)) {
      return res.status(400).json({ success:false, message:'unknown section' });
    }

    if (action === 'add') {
      await User.updateOne(
        { email },
        { $push: { [`questionnaire.${section}`]: value } }
      );
      return res.json({ success:true });
    }

    if (action === 'remove') {
      if (typeof index !== 'number')
        return res.status(400).json({ success:false, message:'index required for remove' });
      const u = await User.findOne({ email });
      if (!u) return res.status(404).json({ success:false, message:'User not found' });
      const arr = Array.isArray(u?.questionnaire?.[section]) ? u.questionnaire[section] : [];
      if (index < 0 || index >= arr.length) return res.status(400).json({ success:false, message:'bad index' });
      arr.splice(index, 1);
      u.questionnaire[section] = arr;
      await u.save();
      return res.json({ success:true });
    }

    res.status(400).json({ success:false, message:'unknown action' });
  } catch (err) {
    console.error('PATCH /api/profile/field error:', err);
    res.status(500).json({ success:false, message:'Server error' });
  }
});


// Serve static assets, but override the default index file:

app.use(express.static(path.join(__dirname, 'public'), {
  index: 'landingpage.html'
}));
// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser:    true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ DB connection failed:", err));

app.post('/api/register', async (req, res) => {
  console.log('📥 Incoming req.body:', req.body);  // for debugging

  try {
    const { fullName, email, password, phone, interest, state } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const user = new User({
      fullName,
      email,
      password,
      phone,
      services: interest,  // 'interest' from frontend mapped to 'services'
      state
    });

    await user.save();
    res.status(201).json({ success: true, message: 'User registered' });

  } catch (err) {
    console.error('❌ Registration error:', err);
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
// POST /api/contact
app.post('/api/contact', async (req, res) => {
  try {
    const { firstName, lastName, email, interest, state, message } = req.body;
    if (!firstName || !lastName || !email || !message) {
      return res
        .status(400)
        .json({ success: false, message: 'All fields are required.' });
    }
    const contact = new Contact({ firstName, lastName, email, interest, state, message });
    await contact.save();
    res.json({ success: true, message: 'Your message has been received.' });
  } catch (err) {
    console.error('Contact route error:', err);
    res.status(500).json({ success: false, message: 'Server error, please try later.' });
  }
});
// STEP 1: Save questionnaire for a user identified by email
app.post('/api/questionnaire', async (req, res) => {
  try {
    // Expect body = { email, ...questionnaireFields }
    const { email, ...questionnaire } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    const user = await User.findOneAndUpdate(
      { email },
      { $set: { questionnaire } },
      { new: true, projection: { password: 0 } }
    );

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, questionnaire: user.questionnaire || null });

  } catch (err) {
    console.error('❌ Questionnaire error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// Multer storage for /api/uploads
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Optional: per-user subfolder by email (sanitized)
    const email = (req.body.email || 'anonymous').replace(/[^a-zA-Z0-9._-]/g, '_');
    const dir = path.join(UPLOAD_DIR, email);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${unique}-${safe}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB per file

// STEP 2: Save uploaded docs; body must include `email`
app.post('/api/uploads', upload.array('files', 6), async (req, res) => {
  try {
    const email = req.body.email;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    const docs = (req.files || []).map(f => ({
      originalname: f.originalname,
      filename:     f.filename,
      mimetype:     f.mimetype,
      size:         f.size,
      url:          `/uploads/${email.replace(/[^a-zA-Z0-9._-]/g, '_')}/${f.filename}`,
      uploadedAt:   new Date()
    }));

    let meta = {};
    if (req.body.meta) {
      try { meta = JSON.parse(req.body.meta); } catch {}
    }

    const update = {
      $push: { documents: { $each: docs } }
    };
    if (meta?.links || meta?.notes) {
      update.$set = {};
      if (meta.links) update.$set['questionnaire.links'] = meta.links;
      if (meta.notes) update.$set['questionnaire.uploadNotes'] = meta.notes;
    }

    const user = await User.findOneAndUpdate(
      { email },
      update,
      { new: true, projection: { password: 0 } }
    );

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, documents: user.documents });

  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// STEP 3: Save final services selection; body: { email, services: [...] }
app.post('/api/services', async (req, res) => {
  try {
    const { email, services } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });
    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one service' });
    }

    const user = await User.findOneAndUpdate(
      { email },
      { $set: { services } },
      { new: true, projection: { password: 0 } }
    );

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, services: user.services });

  } catch (err) {
    console.error('❌ Services error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// Combined profile fetch (email via query string)
app.get('/api/profile', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    const user = await User.findOne({ email }, { password: 0 });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, user });
  } catch (err) {
    console.error('❌ Profile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Default route
app.get('/', (req, res) => res.send('🚀 Careerscopes.online is live!'));

// Start the server
app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
});
