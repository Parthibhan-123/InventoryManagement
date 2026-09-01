const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const publicDir = path.join(__dirname, 'public');

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    const defaultData = { users: [], items: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
  }
}

function readStore() {
  ensureDataStore();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    const fallback = { users: [], items: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

function writeStore(data) {
  ensureDataStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function sanitizeUser(user) {
  if (!user) return null;
  const { id, name, email, createdAt } = user;
  return { id, name, email, createdAt };
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  next();
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'inventory-management-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8,
      secure: false,
    },
  })
);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Inventory API is running.' });
});

app.post('/api/auth/signup', (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  const store = readStore();
  const existingUser = store.users.find((user) => user.email === email);
  if (existingUser) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  store.users.push(user);
  writeStore(store);

  req.session.userId = user.id;
  req.session.userName = user.name;

  res.status(201).json({
    message: 'Account created successfully.',
    user: sanitizeUser(user),
  });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const store = readStore();
  const user = store.users.find((candidate) => candidate.email === email);

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  req.session.userId = user.id;
  req.session.userName = user.name;

  res.json({
    message: 'Login successful.',
    user: sanitizeUser(user),
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ message: 'Unable to log out.' });
    }

    res.json({ message: 'Logged out successfully.' });
  });
});

app.get('/api/session', (req, res) => {
  if (!req.session.userId) {
    return res.json({ user: null });
  }

  const store = readStore();
  const user = store.users.find((candidate) => candidate.id === req.session.userId);
  res.json({ user: sanitizeUser(user) });
});

app.get('/api/items', requireAuth, (req, res) => {
  const store = readStore();
  const items = store.items
    .filter((item) => item.ownerId === req.session.userId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  res.json({ items });
});

app.post('/api/items', requireAuth, (req, res) => {
  const name = String(req.body.name || '').trim();
  const sku = String(req.body.sku || '').trim().toUpperCase();
  const quantity = Number(req.body.quantity);
  const price = Number(req.body.price);
  const category = String(req.body.category || 'General').trim();
  const description = String(req.body.description || '').trim();
  const location = String(req.body.location || 'Main Store').trim();
  const lowStockThreshold = Number(req.body.lowStockThreshold ?? 5);

  if (!name || !sku) {
    return res.status(400).json({ message: 'Item name and SKU are required.' });
  }

  if (Number.isNaN(quantity) || Number.isNaN(price)) {
    return res.status(400).json({ message: 'Quantity and price must be valid numbers.' });
  }

  const store = readStore();
  const item = {
    id: crypto.randomUUID(),
    ownerId: req.session.userId,
    name,
    sku,
    quantity: Number(quantity),
    price: Number(price),
    category: category || 'General',
    description,
    location: location || 'Main Store',
    lowStockThreshold: Number.isFinite(lowStockThreshold) ? Number(lowStockThreshold) : 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.items.push(item);
  writeStore(store);

  res.status(201).json({ message: 'Item added successfully.', item });
});

app.put('/api/items/:id', requireAuth, (req, res) => {
  const store = readStore();
  const itemIndex = store.items.findIndex(
    (item) => item.id === req.params.id && item.ownerId === req.session.userId
  );

  if (itemIndex === -1) {
    return res.status(404).json({ message: 'Item not found.' });
  }

  const existingItem = store.items[itemIndex];
  const updatedItem = {
    ...existingItem,
    ...req.body,
    id: existingItem.id,
    ownerId: req.session.userId,
    sku: String(req.body.sku || existingItem.sku).trim().toUpperCase(),
    name: String(req.body.name || existingItem.name).trim(),
    category: String(req.body.category || existingItem.category).trim(),
    description: String(req.body.description || existingItem.description).trim(),
    location: String(req.body.location || existingItem.location).trim(),
    quantity: Number(req.body.quantity ?? existingItem.quantity),
    price: Number(req.body.price ?? existingItem.price),
    lowStockThreshold: Number(req.body.lowStockThreshold ?? existingItem.lowStockThreshold),
    updatedAt: new Date().toISOString(),
  };

  store.items[itemIndex] = updatedItem;
  writeStore(store);

  res.json({ message: 'Item updated successfully.', item: updatedItem });
});

app.delete('/api/items/:id', requireAuth, (req, res) => {
  const store = readStore();
  const itemIndex = store.items.findIndex(
    (item) => item.id === req.params.id && item.ownerId === req.session.userId
  );

  if (itemIndex === -1) {
    return res.status(404).json({ message: 'Item not found.' });
  }

  store.items.splice(itemIndex, 1);
  writeStore(store);

  res.json({ message: 'Item deleted successfully.' });
});

app.use(express.static(publicDir));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Inventory app running at http://localhost:${PORT}`);
});
