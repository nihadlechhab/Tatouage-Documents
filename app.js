const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration des sessions
app.use(session({
    secret: process.env.SESSION_SECRET || 'votre_secret_session_securise',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 heures
    }
}));

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// Routes API
app.use('/api', require('./routes'));

// Routes du frontend (pour la compatibilité avec votre structure existante)
app.use(require('./routes/router'));

// Route racine - servir la page d'accueil
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Gestion des routes non trouvées pour l'API
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        error: 'Endpoint API non trouvé',
        path: req.originalUrl
    });
});

// Gestion des routes non trouvées pour le frontend
app.use('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Gestion des erreurs globales
app.use((error, req, res, next) => {
    console.error('Erreur serveur:', error);
    res.status(500).json({ 
        error: 'Erreur interne du serveur',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
});

app.listen(PORT, () => {
    console.log(` Serveur démarré sur le port ${PORT}`);
    console.log(` API disponible sur: http://localhost:${PORT}/api`);
    console.log(` Frontend disponible sur: http://localhost:${PORT}`);
});