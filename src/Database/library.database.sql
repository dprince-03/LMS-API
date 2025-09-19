CREATE DATABASE IF NOT EXISTS library_db;

USE library_db;

DROP TABLE IF EXISTS library_db;

CREATE TABLE users (
    id BIGINT UNSINGED NOT NULL AUTO_INCREAMENT PRIMARY KEY,
    fisrt_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) DEFAULT NULL,
    user_name VARCHAR (255) NOT NULL UNIQUE,
    phone VARCHAR(15) DEFAULT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    image_url VARCHAR(255) DEFAULT NULL,
    role ENUM('Admin', 'Librarian', 'User') DEFAULT 'User',
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
    CONSTRAINT UQ_users_email UNIQUE (email , user_name),
    INDEX idx_user_name (user_name),
    INDEX idx_email (email),
    INDEX idx_role (role),
);

CREATE TABLE author {
    id BIGINT UNSINGED NOT NULL AUTO_INCREAMENT PRIMARY KEY,
    fisrt_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    image VARCHAR(255) NOT NULL,
    date_of_birth VARCHAR(255) DEFAULT NULL,
    biography VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(255) DEFAULT NULL,
    email VARCHAR(255) DEFAULT NULL,
    INDEX idx_name (fisrt_name, last_name),    
    INDEX idx_email (email),
};

CREATE TABLE book {
    id BIGINT UNSINGED NOT NULL AUTO_INCREAMENT PRIMARY KEY,
    isbn VARCHAR(255) NOT NULL UNIQUE,
    published_date DATETIME DEFAULT NULL,
    author_id VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    description VARCHAR(255) DEFAULT NULL,
    cover_image VARCHAR(255) DEFAULT NULL,
    genre VARCHAR(255) DEFAULT NULL,
    language VARCHAR(255) DEFAULT NULL,
    pages INT DEFAULT NULL,
    publisher VARCHAR(255) DEFAULT NULL,
    available_copies INT DEFAULT 0,
    total_copies INT DEFAULT 0,
    status ENUM('Available', 'Borrowed', 'Reserved', 'Lost') NOT NULL DEFAULT 'Available',
    FOREIGN KEY (author_id) REFERENCES author(id) ON DELETE SET NULL,
    INDEX idx_title (title),
    INDEX idx_genre (genre),
    INDEX idx_author_id (author_id),
    INDEX idx_status (status),
};

CREATE TABLE borrow_records {
    id BIGINT UNSINGED NOT NULL AUTO_INCREAMENT PRIMARY KEY,
    user_id BIGINT UNSINGED NOT NULL,
    book_id BIGINT UNSINGED NOT NULL,
    borrow_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    return_date DATETIME DEFAULT NULL,
    due_date DATETIME NOT NULL,
    status ENUM('Borrowed', 'Returned', 'Overdue') DEFAULT 'Borrowed',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES book(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_book_id (book_id),
    INDEX idx_status (status),
};