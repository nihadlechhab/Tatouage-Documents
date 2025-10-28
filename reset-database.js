const db = require('./backend/configDB');

async function resetUsers() {
    try {
        // Vider la table users
        await db.promise().query('DELETE FROM users');
        console.log('✅ Table users vidée avec succès!');
        
        // Vérifier que la table est vide
        const [results] = await db.promise().query('SELECT COUNT(*) as count FROM users');
        console.log(`📊 Nombre d'utilisateurs restants: ${results[0].count}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }
}

resetUsers();
