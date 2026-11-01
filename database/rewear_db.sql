-- ReWear: Sustainable Fashion & Circular Clothing Marketplace Database Schema
-- Database: rewear_db (Indian Sustainable Fashion Edition)

CREATE DATABASE IF NOT EXISTS rewear_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rewear_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(25) NULL,
    password VARCHAR(255) NOT NULL,
    location VARCHAR(150) DEFAULT 'New Delhi, India',
    avatar VARCHAR(255) DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    bio TEXT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NULL,
    image_url VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Items Table
CREATE TABLE IF NOT EXISTS items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    gender ENUM('men', 'women', 'kids', 'unisex') NOT NULL,
    size VARCHAR(50) NOT NULL,
    brand VARCHAR(100) DEFAULT 'Indian Artisan / Handloom',
    condition_grade ENUM('brand_new', 'like_new', 'gently_used', 'well_worn') NOT NULL,
    price DECIMAL(10,2) DEFAULT 0.00,
    listing_type ENUM('sell', 'exchange', 'donate') NOT NULL,
    exchange_preferences TEXT NULL,
    donation_preferences TEXT NULL,
    location VARCHAR(150) NOT NULL,
    status ENUM('active', 'reserved', 'sold', 'exchanged', 'donated', 'removed') DEFAULT 'active',
    views_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    INDEX idx_category (category_id),
    INDEX idx_type (listing_type),
    INDEX idx_status (status),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Item Images Table
CREATE TABLE IF NOT EXISTS item_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    INDEX idx_item_image (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Orders Table (E-commerce purchases in INR)
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    item_id INT NOT NULL,
    buyer_id INT NOT NULL,
    seller_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    shipping_address TEXT NOT NULL,
    shipping_city VARCHAR(100) NOT NULL,
    shipping_postal_code VARCHAR(20) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'Simulated UPI / Eco-Pay',
    payment_status ENUM('paid', 'pending', 'refunded') DEFAULT 'paid',
    status ENUM('pending', 'confirmed', 'shipped', 'delivered', 'cancelled') DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_order_buyer (buyer_id),
    INDEX idx_order_seller (seller_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Exchange Requests Table
CREATE TABLE IF NOT EXISTS exchange_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requested_item_id INT NOT NULL,
    offered_item_id INT NOT NULL,
    requester_id INT NOT NULL,
    owner_id INT NOT NULL,
    message TEXT NULL,
    status ENUM('pending', 'accepted', 'rejected', 'completed', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (requested_item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (offered_item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_exchange_req (requester_id),
    INDEX idx_exchange_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Donation Requests Table
CREATE TABLE IF NOT EXISTS donation_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    requester_id INT NOT NULL,
    donor_id INT NOT NULL,
    purpose_message TEXT NOT NULL,
    delivery_mode ENUM('pickup', 'standard_shipping') DEFAULT 'pickup',
    status ENUM('pending', 'approved', 'rejected', 'completed', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_donation_req (requester_id),
    INDEX idx_donation_donor (donor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Wishlist Table
CREATE TABLE IF NOT EXISTS wishlist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    item_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    UNIQUE KEY user_item_unique (user_id, item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(255) NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_notif (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Reports Table
CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reporter_id INT NOT NULL,
    item_id INT NOT NULL,
    reason VARCHAR(100) NOT NULL,
    details TEXT NULL,
    status ENUM('pending', 'reviewed', 'dismissed', 'action_taken') DEFAULT 'pending',
    admin_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    INDEX idx_report_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SEED DATA (Indian Sustainable Fashion & Ashima Admin) --

-- Seed Users (Passwords: Admin@123 and Password@123)
INSERT INTO users (id, name, email, phone, password, location, avatar, bio, role) VALUES
(1, 'Ashima', 'ashima@rewear.in', '+91 98110 54321', '$2a$10$8Ig49..X.gyPxqJiESuZsuXK1sHX44STGA34Ul6TnnX.39IAOhtmy', 'New Delhi, India', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80', 'ReWear Platform Administrator & Circular Indian Fashion Advocate.', 'admin'),
(2, 'Aanya Patel', 'aanya@eco.in', '+91 98201 11223', '$2a$10$WGr3gg5vt20ANXNmPKjpOexL0E4qPTjFby9ucYYwJygMl6KCv.PgW', 'Mumbai, Maharashtra', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80', 'Passionate about Indian handlooms, Kantha embroidery, and sustainable sarees.', 'user'),
(3, 'Rohan Verma', 'rohan@green.in', '+91 98450 99887', '$2a$10$WGr3gg5vt20ANXNmPKjpOexL0E4qPTjFby9ucYYwJygMl6KCv.PgW', 'Bengaluru, Karnataka', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80', 'Upcycling enthusiast. Swapping khadi kurtas and organic cotton apparel.', 'user'),
(4, 'Priya Sundaram', 'priya@circular.in', '+91 98410 44552', '$2a$10$WGr3gg5vt20ANXNmPKjpOexL0E4qPTjFby9ucYYwJygMl6KCv.PgW', 'Chennai, Tamil Nadu', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80', 'Mom of two, circulating outgrown kids festive wear and pure silk stoles.', 'user')
ON DUPLICATE KEY UPDATE id=id;

-- Seed Categories
INSERT INTO categories (id, name, slug, description, image_url) VALUES
(1, 'Men', 'men', 'Pre-loved menswear including khadi kurtas, Nehru jackets, linen shirts, and trousers.', 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&w=600&q=80'),
(2, 'Women', 'women', 'Curated sustainable womenswear, handloom sarees, anarkalis, kurtis, and jackets.', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80'),
(3, 'Kids', 'kids', 'Outgrown festive kurtas, organic mulmul sets, and comfortable playwear.', 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=600&q=80'),
(4, 'Accessories', 'accessories', 'Pure silk dupattas, handcrafted shawls, Shantiniketan leather bags, and stoles.', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80'),
(5, 'Footwear', 'footwear', 'Handcrafted Kolhapuri sandals, leather juttis, and refurbished daily footwear.', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80'),
(6, 'Winter Wear', 'winter-wear', 'Pure Kashmiri Pashmina shawls, merino wool cardigans, and tweed overcoats.', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80')
ON DUPLICATE KEY UPDATE id=id;

-- Seed Items (Indian Ethnic & Contemporary Wear in INR)
INSERT INTO items (id, user_id, category_id, title, description, gender, size, brand, condition_grade, price, listing_type, exchange_preferences, donation_preferences, location, status, views_count) VALUES
(1, 2, 2, 'Upcycled Denim Jacket with Handcrafted Kantha Embroidery', 'Authentic heavy-duty denim jacket custom upcycled with vintage Bengal Kantha hand embroidery on the back panel. Brass buttons, durable pockets, washed with organic natural soapnuts.', 'women', 'M', 'Artisan Upcycled', 'gently_used', 1850.00, 'sell', NULL, NULL, 'Mumbai, Maharashtra', 'active', 142),
(2, 3, 1, 'Pure Khadi Linen Camp Collar Kurta Shirt', 'Breezy handspun 100% certified organic Khadi linen in natural unbleached ivory tone. Mandarin collar with coconut shell buttons. Perfect for Indian summers. Worn only twice.', 'men', 'L', 'Khadi India / Fabindia', 'like_new', 0.00, 'exchange', 'Interested in swapping for an organic cotton Nehru jacket or festive Kurta in size L or XL.', NULL, 'Bengaluru, Karnataka', 'active', 98),
(3, 4, 6, 'Kashmiri Pure Pashmina Wool Embroidered Shawl', 'Authentic hand-embroidered Kashmiri Sozni needlework Pashmina shawl in elegant sage and moss green. Remarkably warm, lightweight, and dry-stored with natural camphorwood.', 'women', 'Free Size', 'Kashmir Loom Heritage', 'like_new', 3400.00, 'sell', NULL, NULL, 'New Delhi', 'active', 215),
(4, 2, 5, 'Handcrafted Kolhapuri Genuine Leather Chappal', 'Authentic vegetable-tanned genuine leather Kolhapuri sandals with braided detailing and cushioned inner soles. Broken in and conditioned with natural mustard oil.', 'unisex', 'L', 'Kolhapur Heritage Crafts', 'gently_used', 1200.00, 'sell', NULL, NULL, 'Pune, Maharashtra', 'active', 180),
(5, 4, 3, 'Kids Festive Silk Kurta & Dhoti Set (Age 5-7)', 'Gently used festive raw silk yellow kurta with traditional maroon dhoti and gold zari border. Clean, no stains. Donating freely to bring festive cheer to a child in need.', 'kids', 'S', 'Fabindia Kids', 'like_new', 0.00, 'donate', NULL, 'Open to any family with young children or community shelter for festive occasions.', 'New Delhi', 'active', 84),
(6, 3, 4, 'Handcrafted Shantiniketan Embossed Leather Crossbody', 'Durable vegetable-tanned goat leather bag with traditional Shantiniketan batik floral embossing. Brass fittings and adjustable shoulder strap with phone sleeve.', 'unisex', 'Free Size', 'Bengal Artisan Guild', 'gently_used', 0.00, 'exchange', 'Looking to swap for a durable canvas weekend duffle or cotton tote bag.', NULL, 'Kolkata, West Bengal', 'active', 119),
(7, 2, 2, 'Handloom Chanderi Cotton-Silk Anarkali Kurti', 'Ethically produced breathable Chanderi cotton-silk blend with gold zari woven booti motifs. Flared silhouette with matching printed mulmul inner lining.', 'women', 'M', 'Anokhi Heritage', 'like_new', 2100.00, 'sell', NULL, NULL, 'Jaipur, Rajasthan', 'active', 76),
(8, 3, 1, 'Handspun Organic Khadi Nehru Jacket', 'Thick organic handspun Khadi jacket in deep forest green. Mandarin collar, Welt chest pocket with coconut wood buttons. Enduring ethnic layer for weddings and gatherings.', 'men', 'M', 'Nicobar / Khadi India', 'brand_new', 1650.00, 'sell', NULL, NULL, 'Ahmedabad, Gujarat', 'active', 63),
(9, 4, 3, 'Toddler Organic Mulmul Cotton Jhabla & Shorts Set', 'Set of 3 ultra-soft hand-block printed organic mulmul cotton jhablas with matching bloomers. Very clean, sterilized, no tears. Donating to extend circular fabric care.', 'kids', 'XS', 'Good Earth Kids', 'gently_used', 0.00, 'donate', NULL, 'Free to single parents, maternity care centers, or expecting families.', 'Chennai, Tamil Nadu', 'active', 52),
(10, 2, 6, 'Heritage Kashmiri Tweed Wool Overcoat', 'Warm pure sheep wool handwoven tweed coat with deep pockets and tailored fit. Warm, windproof, timeless Indian craft statement piece.', 'women', 'L', 'Kashmir Handloom Board', 'like_new', 0.00, 'exchange', 'Looking to swap for a tailored raw silk overcoat or embroidered wool jacket size M or L.', NULL, 'Shimla, Himachal Pradesh', 'active', 104),
(11, 3, 4, 'Pure Tussar Silk Hand-Block Printed Dupatta', 'Smooth handwoven Bhagalpur Tussar silk dupatta featuring authentic Ajrakh natural indigo block prints. Never worn, with original artisan tags.', 'women', 'Free Size', 'Deshaj Handlooms', 'brand_new', 0.00, 'donate', NULL, 'Donating for charity auction, senior citizen care benefit, or youth graduation event.', 'Hyderabad, Telangana', 'active', 41),
(12, 4, 1, 'Indigo Dabu Block-Printed Relaxed Cotton Trousers', 'Hand-dyed organic indigo cotton trousers using traditional mud-resist Dabu printing from Bagru. Relaxed straight fit with drawstring waist. Pristine condition.', 'men', 'M', 'Dabu Craft Jaipur', 'like_new', 1450.00, 'sell', NULL, NULL, 'Jaipur, Rajasthan', 'active', 133)
ON DUPLICATE KEY UPDATE id=id;

-- Seed Item Images
INSERT INTO item_images (id, item_id, image_url, is_primary) VALUES
(1, 1, 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80', TRUE),
(2, 1, 'https://images.unsplash.com/photo-1542272604-780c96856592?auto=format&fit=crop&w=800&q=80', FALSE),
(3, 2, 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80', TRUE),
(4, 2, 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80', FALSE),
(5, 3, 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80', TRUE),
(6, 4, 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&w=800&q=80', TRUE),
(7, 5, 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=800&q=80', TRUE),
(8, 6, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80', TRUE),
(9, 7, 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80', TRUE),
(10, 8, 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=800&q=80', TRUE),
(11, 9, 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80', TRUE),
(12, 10, 'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=800&q=80', TRUE),
(13, 11, 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=800&q=80', TRUE),
(14, 12, 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=80', TRUE)
ON DUPLICATE KEY UPDATE id=id;

-- Seed Orders in INR
INSERT INTO orders (id, order_number, item_id, buyer_id, seller_id, amount, shipping_address, shipping_city, shipping_postal_code, payment_method, payment_status, status) VALUES
(1, 'ORD-2026-1001', 1, 3, 2, 1850.00, '14B Indiranagar 100ft Road', 'Bengaluru', '560038', 'Simulated UPI / Eco-Pay', 'paid', 'delivered'),
(2, 'ORD-2026-1002', 3, 2, 4, 3400.00, '702 Sea View Apartments, Bandra West', 'Mumbai', '400050', 'Simulated UPI / Eco-Pay', 'paid', 'shipped')
ON DUPLICATE KEY UPDATE id=id;

-- Seed Exchanges
INSERT INTO exchange_requests (id, requested_item_id, offered_item_id, requester_id, owner_id, message, status) VALUES
(1, 2, 6, 2, 3, 'Namaste Rohan, I love your handspun khadi shirt. Would you be interested in swapping it for my handcrafted Shantiniketan leather bag?', 'pending'),
(2, 10, 2, 4, 2, 'Hello Aanya, I have an organic khadi shirt in like-new condition. Looking to exchange for your Kashmiri tweed coat.', 'accepted')
ON DUPLICATE KEY UPDATE id=id;

-- Seed Donations
INSERT INTO donation_requests (id, item_id, requester_id, donor_id, purpose_message, delivery_mode, status) VALUES
(1, 5, 3, 4, 'Requesting this kids festive kurta set for an upcoming community Diwali clothing drive in Bengaluru.', 'pickup', 'approved'),
(2, 9, 2, 4, 'Requesting the toddler mulmul dungarees set for an upcoming mother-and-child charitable home.', 'standard_shipping', 'pending')
ON DUPLICATE KEY UPDATE id=id;

-- Seed Wishlist
INSERT INTO wishlist (id, user_id, item_id) VALUES
(1, 2, 3),
(2, 2, 8),
(3, 3, 1),
(4, 4, 12)
ON DUPLICATE KEY UPDATE id=id;

-- Seed Notifications
INSERT INTO notifications (id, user_id, type, title, message, link, is_read) VALUES
(1, 2, 'order', 'Clothing Sold! 🎉', 'Rohan Verma purchased your Upcycled Denim Jacket with Kantha Embroidery for ₹1,850.', '/dashboard.html?tab=orders', FALSE),
(2, 3, 'exchange', 'New Swap Proposal! 🔄', 'Aanya Patel sent you an exchange request for your Pure Khadi Linen Camp Collar Kurta Shirt.', '/exchange.html', FALSE),
(3, 4, 'donation', 'Donation Request Approved! 🎁', 'Your donation of Kids Festive Silk Kurta Set was approved for handover.', '/dashboard.html?tab=donations', TRUE),
(4, 2, 'system', 'Welcome to ReWear! 🌱', 'Thank you for committing to circular Indian fashion and preserving handloom heritage.', '/explore.html', TRUE)
ON DUPLICATE KEY UPDATE id=id;

-- Seed Reports
INSERT INTO reports (id, reporter_id, item_id, reason, details, status) VALUES
(1, 3, 7, 'Incorrect Fabric Specification', 'Listing mentions pure Chanderi silk but the weave appears to be synthetic georgette blend.', 'pending')
ON DUPLICATE KEY UPDATE id=id;
