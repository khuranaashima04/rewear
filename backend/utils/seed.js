const db = require('../config/db');

async function seed() {
    console.log('[Seed] Initializing database...');
    await db.initDatabase();
    const [users] = await db.query('SELECT id, name, email, role FROM users');
    console.log('[Seed] Users available:', users);
    const [items] = await db.query('SELECT id, title, price, listing_type FROM items');
    console.log(`[Seed] Successfully verified ${items.length} clothing items.`);
    process.exit(0);
}

seed().catch(err => {
    console.error('[Seed Error]', err);
    process.exit(1);
});
