const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT, 10) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'rewear_db';

let dbDriver = 'mysql';
let mysqlPool = null;
let sqliteDb = null;

// Initialize Database connection
async function initDatabase() {
    // 1. Attempt MySQL connection first
    try {
        const mysql = require('mysql2/promise');
        
        const rootConn = await mysql.createConnection({
            host: DB_HOST,
            port: DB_PORT,
            user: DB_USER,
            password: DB_PASSWORD
        });

        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await rootConn.end();

        mysqlPool = mysql.createPool({
            host: DB_HOST,
            port: DB_PORT,
            user: DB_USER,
            password: DB_PASSWORD,
            database: DB_NAME,
            waitForConnections: true,
            connectionLimit: 15,
            queueLimit: 0,
            decimalNumbers: true
        });

        const [testRows] = await mysqlPool.query('SELECT 1 + 1 AS result');
        console.log(`[DB] Successfully connected to MySQL database: ${DB_NAME} on ${DB_HOST}:${DB_PORT}`);

        const [tables] = await mysqlPool.query(`SHOW TABLES LIKE 'users'`);
        if (tables.length === 0) {
            console.log('[DB] Initializing MySQL tables and demo records from rewear_db.sql...');
            await runSqlFile(mysqlPool);
            console.log('[DB] MySQL schema and seed data loaded successfully!');
        }

        dbDriver = 'mysql';
        return;
    } catch (err) {
        console.warn(`[DB WARNING] MySQL connection attempt to ${DB_HOST}:${DB_PORT}/${DB_NAME} failed: ${err.message}`);
        console.warn('[DB WARNING] Switching to embedded SQLite engine (database/rewear_db.sqlite) to ensure 100% seamless functionality without external MySQL daemon.');
    }

    // 2. Resilient fallback to SQLite
    try {
        const sqlite3 = require('sqlite3').verbose();
        const dbPath = path.join(__dirname, '../../database/rewear_db.sqlite');
        
        sqliteDb = new sqlite3.Database(dbPath);
        dbDriver = 'sqlite';

        await setupSqliteSchema();
        console.log(`[DB] Embedded SQLite database initialized at ${dbPath}`);
    } catch (err) {
        console.error('[DB FATAL] Failed to initialize fallback SQLite database:', err);
        throw err;
    }
}

async function runSqlFile(pool) {
    const sqlFilePath = path.join(__dirname, '../../database/rewear_db.sql');
    if (!fs.existsSync(sqlFilePath)) return;

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    const statements = sqlContent
        .replace(/--.*$/gm, '')
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.toLowerCase().startsWith('create database') && !s.toLowerCase().startsWith('use '));

    for (const stmt of statements) {
        try {
            await pool.query(stmt);
        } catch (e) {
            if (!e.message.includes('already exists') && !e.message.includes('Duplicate entry')) {
                console.error('[DB Seed Notice]', e.message);
            }
        }
    }
}

function setupSqliteSchema() {
    return new Promise((resolve, reject) => {
        sqliteDb.serialize(() => {
            sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                phone TEXT,
                password TEXT NOT NULL,
                location TEXT DEFAULT 'New Delhi, India',
                avatar TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
                bio TEXT,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                slug TEXT NOT NULL UNIQUE,
                description TEXT,
                image_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                category_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                gender TEXT NOT NULL,
                size TEXT NOT NULL,
                brand TEXT DEFAULT 'Indian Artisan / Handloom',
                condition_grade TEXT NOT NULL,
                price REAL DEFAULT 0.00,
                listing_type TEXT NOT NULL,
                exchange_preferences TEXT,
                donation_preferences TEXT,
                location TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                views_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories(id)
            )`);

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS item_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER NOT NULL,
                image_url TEXT NOT NULL,
                is_primary INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
            )`);

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_number TEXT NOT NULL UNIQUE,
                item_id INTEGER NOT NULL,
                buyer_id INTEGER NOT NULL,
                seller_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                shipping_address TEXT NOT NULL,
                shipping_city TEXT NOT NULL,
                shipping_postal_code TEXT NOT NULL,
                payment_method TEXT DEFAULT 'Simulated UPI / Eco-Pay',
                payment_status TEXT DEFAULT 'paid',
                status TEXT DEFAULT 'confirmed',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES items(id),
                FOREIGN KEY (buyer_id) REFERENCES users(id),
                FOREIGN KEY (seller_id) REFERENCES users(id)
            )`);

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS exchange_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                requested_item_id INTEGER NOT NULL,
                offered_item_id INTEGER NOT NULL,
                requester_id INTEGER NOT NULL,
                owner_id INTEGER NOT NULL,
                message TEXT,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (requested_item_id) REFERENCES items(id) ON DELETE CASCADE,
                FOREIGN KEY (offered_item_id) REFERENCES items(id) ON DELETE CASCADE,
                FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS donation_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER NOT NULL,
                requester_id INTEGER NOT NULL,
                donor_id INTEGER NOT NULL,
                purpose_message TEXT NOT NULL,
                delivery_mode TEXT DEFAULT 'pickup',
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
                FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS wishlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                item_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
                UNIQUE(user_id, item_id)
            )`);

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                link TEXT,
                is_read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reporter_id INTEGER NOT NULL,
                item_id INTEGER NOT NULL,
                reason TEXT NOT NULL,
                details TEXT,
                status TEXT DEFAULT 'pending',
                admin_notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
            )`);

            // Seed or refresh users & items
            sqliteDb.get("SELECT COUNT(*) as count FROM users WHERE email = 'ashima@rewear.in'", (err, row) => {
                if (err) return reject(err);
                if (row && row.count > 0) {
                    return resolve();
                }

                // Clean and seed fresh Indian data with Ashima Admin
                const seedSql = `
                DELETE FROM users;
                DELETE FROM categories;
                DELETE FROM items;
                DELETE FROM item_images;
                DELETE FROM orders;
                DELETE FROM exchange_requests;
                DELETE FROM donation_requests;
                DELETE FROM wishlist;
                DELETE FROM notifications;
                DELETE FROM reports;

                INSERT INTO users (id, name, email, phone, password, location, avatar, bio, role) VALUES
                (1, 'Ashima', 'ashima@rewear.in', '+91 98110 54321', '$2a$10$8Ig49..X.gyPxqJiESuZsuXK1sHX44STGA34Ul6TnnX.39IAOhtmy', 'New Delhi, India', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80', 'ReWear Platform Administrator & Circular Indian Fashion Advocate.', 'admin'),
                (2, 'Aanya Patel', 'aanya@eco.in', '+91 98201 11223', '$2a$10$WGr3gg5vt20ANXNmPKjpOexL0E4qPTjFby9ucYYwJygMl6KCv.PgW', 'Mumbai, Maharashtra', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80', 'Passionate about Indian handlooms, Kantha embroidery, and sustainable sarees.', 'user'),
                (3, 'Rohan Verma', 'rohan@green.in', '+91 98450 99887', '$2a$10$WGr3gg5vt20ANXNmPKjpOexL0E4qPTjFby9ucYYwJygMl6KCv.PgW', 'Bengaluru, Karnataka', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80', 'Upcycling enthusiast. Swapping khadi kurtas and organic cotton apparel.', 'user'),
                (4, 'Priya Sundaram', 'priya@circular.in', '+91 98410 44552', '$2a$10$WGr3gg5vt20ANXNmPKjpOexL0E4qPTjFby9ucYYwJygMl6KCv.PgW', 'Chennai, Tamil Nadu', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80', 'Mom of two, circulating outgrown kids festive wear and pure silk stoles.', 'user');

                INSERT INTO categories (id, name, slug, description, image_url) VALUES
                (1, 'Men', 'men', 'Pre-loved menswear including khadi kurtas, Nehru jackets, linen shirts, and trousers.', 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&w=600&q=80'),
                (2, 'Women', 'women', 'Curated sustainable womenswear, handloom sarees, anarkalis, kurtis, and jackets.', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80'),
                (3, 'Kids', 'kids', 'Outgrown festive kurtas, organic mulmul sets, and comfortable playwear.', 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=600&q=80'),
                (4, 'Accessories', 'accessories', 'Pure silk dupattas, handcrafted shawls, Shantiniketan leather bags, and stoles.', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80'),
                (5, 'Footwear', 'footwear', 'Handcrafted Kolhapuri sandals, leather juttis, and refurbished daily footwear.', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80'),
                (6, 'Winter Wear', 'winter-wear', 'Pure Kashmiri Pashmina shawls, merino wool cardigans, and tweed overcoats.', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80');

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
                (12, 4, 1, 'Indigo Dabu Block-Printed Relaxed Cotton Trousers', 'Hand-dyed organic indigo cotton trousers using traditional mud-resist Dabu printing from Bagru. Relaxed straight fit with drawstring waist. Pristine condition.', 'men', 'M', 'Dabu Craft Jaipur', 'like_new', 1450.00, 'sell', NULL, NULL, 'Jaipur, Rajasthan', 'active', 133);

                INSERT INTO item_images (id, item_id, image_url, is_primary) VALUES
                (1, 1, 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80', 1),
                (2, 1, 'https://images.unsplash.com/photo-1542272604-780c96856592?auto=format&fit=crop&w=800&q=80', 0),
                (3, 2, 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80', 1),
                (4, 2, 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80', 0),
                (5, 3, 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80', 1),
                (6, 4, 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&w=800&q=80', 1),
                (7, 5, 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=800&q=80', 1),
                (8, 6, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80', 1),
                (9, 7, 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80', 1),
                (10, 8, 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=800&q=80', 1),
                (11, 9, 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80', 1),
                (12, 10, 'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=800&q=80', 1),
                (13, 11, 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=800&q=80', 1),
                (14, 12, 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=80', 1);

                INSERT INTO orders (id, order_number, item_id, buyer_id, seller_id, amount, shipping_address, shipping_city, shipping_postal_code, payment_method, payment_status, status) VALUES
                (1, 'ORD-2026-1001', 1, 3, 2, 1850.00, '14B Indiranagar 100ft Road', 'Bengaluru', '560038', 'Simulated UPI / Eco-Pay', 'paid', 'delivered'),
                (2, 'ORD-2026-1002', 3, 2, 4, 3400.00, '702 Sea View Apartments, Bandra West', 'Mumbai', '400050', 'Simulated UPI / Eco-Pay', 'paid', 'shipped');

                INSERT INTO exchange_requests (id, requested_item_id, offered_item_id, requester_id, owner_id, message, status) VALUES
                (1, 2, 6, 2, 3, 'Namaste Rohan, I love your handspun khadi shirt. Would you be interested in swapping it for my handcrafted Shantiniketan leather bag?', 'pending'),
                (2, 10, 2, 4, 2, 'Hello Aanya, I have an organic khadi shirt in like-new condition. Looking to exchange for your Kashmiri tweed coat.', 'accepted');

                INSERT INTO donation_requests (id, item_id, requester_id, donor_id, purpose_message, delivery_mode, status) VALUES
                (1, 5, 3, 4, 'Requesting this kids festive kurta set for an upcoming community Diwali clothing drive in Bengaluru.', 'pickup', 'approved'),
                (2, 9, 2, 4, 'Requesting the toddler mulmul dungarees set for an upcoming mother-and-child charitable home.', 'standard_shipping', 'pending');

                INSERT INTO wishlist (id, user_id, item_id) VALUES
                (1, 2, 3),
                (2, 2, 8),
                (3, 3, 1),
                (4, 4, 12);

                INSERT INTO notifications (id, user_id, type, title, message, link, is_read) VALUES
                (1, 2, 'order', 'Clothing Sold! 🎉', 'Rohan Verma purchased your Upcycled Denim Jacket with Kantha Embroidery for ₹1,850.', '/dashboard.html?tab=orders', 0),
                (2, 3, 'exchange', 'New Swap Proposal! 🔄', 'Aanya Patel sent you an exchange request for your Pure Khadi Linen Camp Collar Kurta Shirt.', '/exchange.html', 0),
                (3, 4, 'donation', 'Donation Request Approved! 🎁', 'Your donation of Kids Festive Silk Kurta Set was approved for handover.', '/dashboard.html?tab=donations', 1),
                (4, 2, 'system', 'Welcome to ReWear! 🌱', 'Thank you for committing to circular Indian fashion and preserving handloom heritage.', '/explore.html', 1);

                INSERT INTO reports (id, reporter_id, item_id, reason, details, status) VALUES
                (1, 3, 7, 'Incorrect Fabric Specification', 'Listing mentions pure Chanderi silk but the weave appears to be synthetic georgette blend.', 'pending');
                `;

                sqliteDb.exec(seedSql, (execErr) => {
                    if (execErr) {
                        console.error('[DB SQLite Seed Error]', execErr.message);
                        return reject(execErr);
                    }
                    resolve();
                });
            });
        });
    });
}

// Universal query function compatible with MySQL & SQLite
async function query(sql, params = []) {
    if (dbDriver === 'mysql' && mysqlPool) {
        const [rows, fields] = await mysqlPool.query(sql, params);
        return [rows, fields];
    } else if (dbDriver === 'sqlite' && sqliteDb) {
        return new Promise((resolve, reject) => {
            const trimmedSql = sql.trim();
            const upperSql = trimmedSql.toUpperCase();

            let formattedSql = trimmedSql;
            formattedSql = formattedSql.replace(/CONCAT\(([^,]+),\s*([^)]+)\)/gi, '($1 || $2)');
            formattedSql = formattedSql.replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP');

            if (upperSql.startsWith('SELECT') || upperSql.startsWith('PRAGMA') || upperSql.startsWith('SHOW')) {
                sqliteDb.all(formattedSql, params, (err, rows) => {
                    if (err) return reject(err);
                    resolve([rows, null]);
                });
            } else {
                sqliteDb.run(formattedSql, params, function (err) {
                    if (err) return reject(err);
                    const result = {
                        insertId: this.lastID,
                        affectedRows: this.changes,
                        warningStatus: 0
                    };
                    resolve([result, null]);
                });
            }
        });
    } else {
        throw new Error('Database is not initialized.');
    }
}

module.exports = {
    initDatabase,
    query,
    getDriver: () => dbDriver,
    getPool: () => mysqlPool
};
