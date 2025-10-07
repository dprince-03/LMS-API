# **Library Management System API**

A comprehensive RESTful API for managing library operations with authentication, role-based access control, and a complete book borrowing system.

## **🚀 Features**

- **🔐 JWT Authentication** - Secure user authentication with JSON Web Tokens
- **👥 Role-Based Access Control** - Three user roles (Admin, Librarian, User)
- **📚 Book Borrowing System** - Complete borrowing and return workflow with due date tracking
- **⏰ Overdue Management** - Automatic overdue detection and late fee calculation
- **🔍 Search & Pagination** - Advanced search with pagination on all list endpoints
- **✅ Input Validation** - Comprehensive validation and sanitization
- **🛡️ Rate Limiting** - Role-based rate limiting for API security
- **🔒 Security Headers** - Multiple security layers including CORS, XSS protection
- **📝 Request Logging** - Detailed logging of all API requests
- **❌ Error Handling** - Centralized error handling with proper HTTP status codes

## **🛠️ Tech Stack**

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Environment Variables**: dotenv

## **📦 Installation**

```bash
# Clone the repository
git clone <repository-url>
cd LMS-API

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Generate secure secrets
node generate-secrets.js

# Set up database
mysql -u root -p < library.database.sql

# Start the server
npm run dev
```

## **⚙️ Environment Variables**

Create a .env file with the following variables:

```
# Server

PORT=5080
NODE_ENV=development

# Database

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=library_db
DB_PORT=3306

# JWT

JWT_SECRET=your_super_secret_key_here
JWT_EXPIRE=7d

# Security

CORS_ORIGINS=<http://localhost:3000,http://localhost:3001>
BCRYPT_ROUNDS=12
INITIAL_SETUP_KEY=your_secure_setup_key_here
```

## **🗄️ Database Schema**

The system uses 4 main tables:

- **users** - User accounts with roles (Admin, Librarian, User)
- **authors** - Book authors information
- **books** - Book inventory and availability
- **borrow_records** - Track book borrowing and returns

## **🔌 API Endpoints**

### Authentication

| Method | Endpoint                  | Description              | Access                  |
| ------ | ------------------------- | ------------------------ | ----------------------- |
| POST   | /api/auth/register        | Register new user        | Public                  |
| POST   | /api/auth/login           | Login user               | Public                  |
| GET    | /api/auth/me              | Get current user profile | Protected               |
| POST   | /api/auth/logout          | Logout user              | Protected               |
| POST   | /api/auth/refresh         | Refresh JWT token        | Protected               |
| POST   | /api/auth/change-password | Change password          | Protected               |
| POST   | /api/auth/setup-admin     | Initial admin setup      | Public (with setup key) |

### Authors

| Method | Endpoint         | Description      | Access          |
| ------ | ---------------- | ---------------- | --------------- |
| GET    | /api/authors     | Get all authors  | Public          |
| GET    | /api/authors/:id | Get author by ID | Public          |
| POST   | /api/authors     | Create author    | Admin/Librarian |
| PUT    | /api/authors/:id | Update author    | Admin/Librarian |
| DELETE | /api/authors/:id | Delete author    | Admin/Librarian |

### Books

| Method | Endpoint              | Description                | Access          |
| ------ | --------------------- | -------------------------- | --------------- |
| GET    | /api/books            | Get all books with filters | Public          |
| GET    | /api/books/:id        | Get book by ID             | Public          |
| POST   | /api/books            | Create book                | Admin/Librarian |
| PUT    | /api/books/:id        | Update book                | Admin/Librarian |
| DELETE | /api/books/:id        | Delete book                | Admin/Librarian |
| POST   | /api/books/:id/borrow | Borrow a book              | Authenticated   |
| POST   | /api/books/:id/return | Return a book              | Authenticated   |

### Users

| Method | Endpoint                      | Description              | Access              |
| ------ | ----------------------------- | ------------------------ | ------------------- |
| GET    | /api/users                    | Get all users            | Admin               |
| GET    | /api/users/public             | Get public users list    | Public              |
| GET    | /api/users/profile            | Get current user profile | Protected           |
| GET    | /api/users/:id                | Get user by ID           | Admin/Librarian/Own |
| GET    | /api/users/:id/borrow-records | Get user borrow records  | Protected           |
| POST   | /api/users                    | Create user              | Admin               |
| PUT    | /api/users/:id                | Update user              | Admin/Own           |
| DELETE | /api/users/:id                | Delete user              | Admin               |

### Borrow Records

| col1 | Endpoint                       | Description            | Access               |
| ---- | ------------------------------ | ---------------------- | -------------------- |
| GET  | /api/borrow-records            | Get all borrow records | Admin/Librarian      |
| GET  | /api/borrow-records/overdue    | Get overdue records    | Admin/Librarian      |
| GET  | /api/borrow-records/statistics | Get borrowing stats    | Admin/Librarian      |
| POST | /api/borrow-records/:id/extend | Extend due date        | User/Admin/Librarian |

## **🔐 Authentication**

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Example Login Request

```
curl -X POST http://localhost:5080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrUsername": "user@example.com",
    "password": "Password123"
  }'
```

## **👥 Role-Based Access**

### Admin

- Full system access
- User management (CRUD operations)
- Book and author management
- View all borrow records and statistics
- System configuration

### Librarian

- Book and author management
- View and update user profiles
- Manage borrow records
- View statistics
- Cannot delete users or modify system settings

### User

- Browse books and authors
- Borrow and return books
- View own borrow history
- Update own profile
- Cannot access admin features

## **🔍 Query Parameters**

### Pagination

- **page** - Page number (default: 1)
- **limit** - Items per page (default: 10, max: 100)

### Search

- **search** - Search query string across relevant fields

### Filters

- **status** - Filter by status (Available, Borrowed, Overdue, etc.)
- **author_id** - Filter books by author
- **genre** - Filter books by genre
- **role** - Filter users by role
- **is_active** - Filter users by active status
- **overdue_only** - Filter for overdue records only

### Example

```bash
GET /api/books?page=1&limit=20&search=harry&genre=Fantasy&status=Available
```

## **📋 Business Rules**

### Borrowing System

- Maximum 5 books per user simultaneously
- Default loan period: 14 days (configurable)
- Cannot borrow same book twice simultaneously
- Book must be available (available_copies > 0)
- Users must have active account status

### Returns & Overdue

- Late fee: $1 per day after due date
- Book becomes available immediately after return
- Overdue status automatically updated
- Due dates can be extended (once per borrow)

### Validation Rules

- Email must be unique and valid format
- ISBN must be unique
- Password minimum 8 characters with complexity requirements
- Phone numbers validated for format
- Required fields enforced on all models

## **🛡️ Security Features**

### Rate Limiting

- **Guest**: 20 requests/15 minutes
- **User**: 60 requests/15 minutes
- **Librarian**: 120 requests/15 minutes
- **Admin**: 300 requests/15 minutes

### Input Sanitization

- XSS protection
- SQL injection prevention
- HTML tag removal
- Parameter validation

### Security Headers

- **X-Frame-Options: DENY**
- **X-Content-Type-Options: nosniff**
- **X-XSS-Protection: 1; mode=block**
- **Strict-Transport-Security**
- **Content Security Policy**

## **❌ Error Responses**

All error responses follow this format:

```
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message",
  "errors": [] // Optional validation errors
}
```

### HTTP Status Codes

- **200** - Success
- **201** - Created
- **400** - Bad Request / Validation Error
- **401** - Unauthorized
- **403** - Forbidden
- **404** - Not Found
- **409** - Conflict
- **429** - Too Many Requests
- **500** - Internal Server Error

## 🚀 Quick Start

### 1. Initial Setup

```
# Clone and install
git clone <repository>
npm install

# Generate secrets
node generate-secrets.js

# Setup database
mysql -u root -p < library.database.sql

# Start development server
npm run dev
```

### 2. Create Admin User

```
# Use the setup key from your .env file
curl -X POST http://localhost:5080/api/auth/setup-admin \
  -H "Content-Type: application/json" \
  -d '{
    "admin_email": "admin@yourlibrary.com",
    "admin_password": "SecurePass123!",
    "setup_key": "YOUR_SETUP_KEY_FROM_ENV"
  }'
```

### 3. Test the API

```
# Login as admin
curl -X POST <http://localhost:5080/api/auth/login> \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrUsername": "<admin@yourlibrary.com>",
    "password": "SecurePass123!"
  }'

# Use the returned token for protected endpoints
curl -X GET <http://localhost:5080/api/auth/me> \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## **📁 Project Structure**

```
LMS-API/
├── src/
│   ├── config/
│   │   ├── database.config.js    # Database configuration
│   │   └── auth.config.js        # Authentication configuration
│   ├── controllers/
│   │   ├── auth.controllers.js      # Authentication logic
│   │   ├── authors.controllers.js   # Author management
│   │   ├── books.controllers.js     # Book management
│   │   ├── users.controllers.js     # User management
│   │   └── bookRecords.controllers.js # Borrow records
│   ├── middlewares/
│   │   └── auth.middlewares.js      # Authentication & authorization
│   ├── models/
│   │   ├── authors.model.js         # Author data operations
│   │   ├── books.model.js           # Book data operations
│   │   ├── users.model.js           # User data operations
│   │   └── borrowedRecords.model.js # Borrow record operations
│   ├── routes/
│   │   ├── auth.routes.js           # Authentication routes
│   │   ├── authors.routes.js        # Author routes
│   │   ├── books.routes.js          # Book routes
│   │   ├── users.routes.js          # User routes
│   │   └── bookRecords.routes.js    # Borrow record routes
│   └── utils/
├── library.database.sql          # Database schema
├── generate-secrets.js           # Secret generation script
├── .env                          # Environment variables
├── package.json
├── server.js                     # Main server file
└── README.md
```

## **🧪 Development**

```
# Run in development mode with auto-reload
npm run dev

# Run in production mode
npm start

# Generate new secrets
node generate-secrets.js
```

## **📝 Example Requests**

### User Registration

```
curl -X POST http://localhost:5080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "user_name": "johndoe",
    "email": "john@example.com",
    "password": "Password123"
  }'
```

### Create Book

```
curl -X POST http://localhost:5080/api/books \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isbn": "978-0451524935",
    "title": "1984",
    "author_id": 1,
    "published_date": "1949-06-08",
    "genre": "Dystopian Fiction",
    "total_copies": 5
  }'
```

### Borrow Book

```
curl -X POST http://localhost:5080/api/books/1/borrow \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "due_days": 21
  }'
```

## 🤝 Contributing

- Fork the repository
- Create your feature branch **(git checkout -b feature/AmazingFeature)**
- Commit your changes **(git commit -m 'Add some AmazingFeature')**
- Push to the branch **(git push origin feature/AmazingFeature)**
- Open a Pull Request

<!-- # contact:  -->

<!-- **Adejare Adedayo** - princeadedayo03@gmail.com -->

<!-- ### **whatsapp or telegram :**  09083497555 -->
