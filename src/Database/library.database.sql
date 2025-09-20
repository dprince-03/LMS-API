CREATE DATABASE IF NOT EXISTS library_db;
USE library_db;

-- Fixed Users table
CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) DEFAULT NULL,
    user_name VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(15) DEFAULT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    image_url VARCHAR(255) DEFAULT NULL,
    role ENUM('Admin', 'Librarian', 'User') DEFAULT 'User',
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL,
    INDEX idx_user_name (user_name),
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- Fixed Authors table
CREATE TABLE authors (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    image VARCHAR(255) DEFAULT NULL,
    date_of_birth DATE DEFAULT NULL,
    biography TEXT DEFAULT NULL,
    phone VARCHAR(255) DEFAULT NULL,
    email VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (first_name, last_name),    
    INDEX idx_email (email)
);

-- Fixed Books table
CREATE TABLE books (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    isbn VARCHAR(255) NOT NULL UNIQUE,
    published_date DATE DEFAULT NULL,
    author_id BIGINT UNSIGNED DEFAULT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    cover_image VARCHAR(255) DEFAULT NULL,
    genre VARCHAR(255) DEFAULT NULL,
    language VARCHAR(255) DEFAULT NULL,
    pages INT DEFAULT NULL,
    publisher VARCHAR(255) DEFAULT NULL,
    available_copies INT DEFAULT 0,
    total_copies INT DEFAULT 0,
    status ENUM('Available', 'Borrowed', 'Reserved', 'Lost') NOT NULL DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE SET NULL,
    INDEX idx_title (title),
    INDEX idx_genre (genre),
    INDEX idx_author_id (author_id),
    INDEX idx_status (status)
);

-- Fixed Borrow Records table
CREATE TABLE borrow_records (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    book_id BIGINT UNSIGNED NOT NULL,
    borrow_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    return_date DATETIME DEFAULT NULL,
    due_date DATETIME NOT NULL,
    status ENUM('Borrowed', 'Returned', 'Overdue') DEFAULT 'Borrowed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_book_id (book_id),
    INDEX idx_status (status)
);