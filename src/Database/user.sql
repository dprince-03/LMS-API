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

};

CREATE TABLE book {
    id BIGINT UNSINGED NOT NULL AUTO_INCREAMENT PRIMARY KEY,
    isbn VARCHAR(255) NOT NULL UNIQUE,
    published_date VARCHAR(255),
    book_id VARCHAR(255),
    FOREIGN KEY (book_id) 
};