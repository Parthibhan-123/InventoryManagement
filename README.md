# Inventory Management Base Project

A ready-to-run inventory management application with user authentication and a responsive dashboard frontend. It includes:

- Sign up and login flows
- Session-based authentication
- Inventory item creation, editing, and deletion
- Product quantity, price, SKU, category, and low-stock tracking
- Clean dashboard UI with summary cards and inventory table

## Stack

- Node.js
- Express.js
- Express Session
- bcryptjs
- Plain HTML, CSS, and JavaScript frontend

## Project structure

```text
inventory-management/
├── public/
│   ├── app.js
│   ├── index.html
│   ├── styles.css
├── data/
│   └── store.json
├── package.json
├── server.js
└── README.md
```

## Run locally

1. Open a terminal in this folder.
2. Install dependencies:

```bash
npm install
```

3. Start the app:

```bash
npm start
```

4. Open your browser at:

```text
http://localhost:3000
```

## Features

- Create an account with name, email, and password
- Login/logout securely with session cookies
- Add inventory products with name, SKU, quantity, price, location, and low-stock threshold
- Edit or delete products from the dashboard
- View total item count, total stock units, inventory value, and low-stock items

## Demo login

The project includes a ready-to-use demo account for quick testing:

- Email: `seconduser@example.com`
- Password: `123456`

## Notes

- Data is stored in `data/store.json` for quick setup and local testing.
- You can change the port by running:

```bash
PORT=4000 npm start
```

This project is intentionally lightweight so it works out of the box without any external database setup.
