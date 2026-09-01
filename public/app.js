const authPage = document.getElementById('auth-page');
const appPage = document.getElementById('app-page');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const itemForm = document.getElementById('itemForm');
const itemsTableBody = document.getElementById('itemsTableBody');
const userLabel = document.getElementById('userLabel');
const logoutBtn = document.getElementById('logoutBtn');
const toast = document.getElementById('toast');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formTitle = document.getElementById('formTitle');

const state = {
  user: null,
  items: [],
  editingId: null,
};

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => toast.classList.add('hidden'), 2500);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    credentials: 'same-origin',
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || 'Something went wrong.');
  }

  return payload;
}

function toggleAuthView(showAuth) {
  authPage.classList.toggle('hidden', !showAuth);
  appPage.classList.toggle('hidden', showAuth);
}

function resetItemForm() {
  itemForm.reset();
  itemForm.elements.quantity.value = 0;
  itemForm.elements.price.value = 0;
  itemForm.elements.lowStockThreshold.value = 5;
  state.editingId = null;
  formTitle.textContent = 'Add Inventory Item';
  cancelEditBtn.classList.add('hidden');
}

function renderSummary() {
  const totalItems = state.items.length;
  const totalUnits = state.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const inventoryValue = state.items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
    0
  );
  const lowStockCount = state.items.filter(
    (item) => Number(item.quantity || 0) <= Number(item.lowStockThreshold || 0)
  ).length;

  document.getElementById('totalItems').textContent = String(totalItems);
  document.getElementById('totalUnits').textContent = String(totalUnits);
  document.getElementById('inventoryValue').textContent = formatCurrency(inventoryValue);
  document.getElementById('lowStockCount').textContent = String(lowStockCount);
}

function renderItemsTable() {
  itemsTableBody.innerHTML = '';

  if (!state.items.length) {
    itemsTableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; color: #5d6b82; padding: 24px;">No inventory items yet. Add your first item above.</td>
      </tr>
    `;
    return;
  }

  state.items.forEach((item) => {
    const lowStock = Number(item.quantity || 0) <= Number(item.lowStockThreshold || 0);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <strong>${item.name}</strong><br />
        <small>${item.description || 'No description provided'}</small>
      </td>
      <td>${item.sku}</td>
      <td>${item.category || 'General'}</td>
      <td>${item.location || 'Main Store'}</td>
      <td>${item.quantity}</td>
      <td>${formatCurrency(item.price)}</td>
      <td>
        <span class="status-pill ${lowStock ? 'warning' : 'safe'}">
          ${lowStock ? 'Low Stock' : 'Healthy'}
        </span>
      </td>
      <td>
        <div class="action-group">
          <button class="action-btn" data-action="edit" data-id="${item.id}" type="button">Edit</button>
          <button class="action-btn delete" data-action="delete" data-id="${item.id}" type="button">Delete</button>
        </div>
      </td>
    `;
    itemsTableBody.appendChild(row);
  });
}

async function loadSession() {
  try {
    const data = await request('/api/session');
    state.user = data.user;

    if (state.user) {
      toggleAuthView(false);
      userLabel.textContent = `Hello, ${state.user.name}`;
      await loadItems();
      return;
    }

    toggleAuthView(true);
    userLabel.textContent = 'Guest';
    state.items = [];
    renderSummary();
    renderItemsTable();
  } catch (error) {
    showToast(error.message);
  }
}

async function loadItems() {
  try {
    const data = await request('/api/items');
    state.items = data.items || [];
    renderSummary();
    renderItemsTable();
  } catch (error) {
    showToast(error.message);
  }
}

function populateItemForm(item) {
  state.editingId = item.id;
  formTitle.textContent = 'Edit Inventory Item';
  cancelEditBtn.classList.remove('hidden');

  itemForm.elements.name.value = item.name || '';
  itemForm.elements.sku.value = item.sku || '';
  itemForm.elements.category.value = item.category || '';
  itemForm.elements.location.value = item.location || '';
  itemForm.elements.quantity.value = item.quantity ?? 0;
  itemForm.elements.price.value = item.price ?? 0;
  itemForm.elements.lowStockThreshold.value = item.lowStockThreshold ?? 5;
  itemForm.elements.description.value = item.description || '';
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);

  try {
    await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: formData.get('email'),
        password: formData.get('password'),
      }),
    });

    loginForm.reset();
    await loadSession();
    showToast('Login successful.');
  } catch (error) {
    showToast(error.message);
  }
});

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(signupForm);

  try {
    await request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
      }),
    });

    signupForm.reset();
    await loadSession();
    showToast('Account created successfully.');
  } catch (error) {
    showToast(error.message);
  }
});

itemForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(itemForm);
  const payload = {
    name: formData.get('name'),
    sku: formData.get('sku'),
    category: formData.get('category'),
    location: formData.get('location'),
    quantity: Number(formData.get('quantity')),
    price: Number(formData.get('price')),
    lowStockThreshold: Number(formData.get('lowStockThreshold')),
    description: formData.get('description'),
  };

  try {
    if (state.editingId) {
      await request(`/api/items/${state.editingId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showToast('Item updated successfully.');
    } else {
      await request('/api/items', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Item added successfully.');
    }

    resetItemForm();
    await loadItems();
  } catch (error) {
    showToast(error.message);
  }
});

itemsTableBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const { action, id } = button.dataset;
  const item = state.items.find((record) => record.id === id);

  if (!item) return;

  if (action === 'edit') {
    populateItemForm(item);
    return;
  }

  if (action === 'delete') {
    const confirmed = window.confirm(`Delete ${item.name}?`);
    if (!confirmed) return;

    try {
      await request(`/api/items/${id}`, { method: 'DELETE' });
      showToast('Item deleted successfully.');
      await loadItems();
      if (state.editingId === id) {
        resetItemForm();
      }
    } catch (error) {
      showToast(error.message);
    }
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await request('/api/auth/logout', { method: 'POST' });
    resetItemForm();
    await loadSession();
    showToast('Logged out successfully.');
  } catch (error) {
    showToast(error.message);
  }
});

cancelEditBtn.addEventListener('click', resetItemForm);

document.querySelectorAll('[data-auth-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.authTab;
    const isLogin = target === 'login';
    loginForm.classList.toggle('hidden', !isLogin);
    signupForm.classList.toggle('hidden', isLogin);
    document.querySelectorAll('[data-auth-tab]').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.authTab === target);
    });
  });
});

resetItemForm();
loadSession();
