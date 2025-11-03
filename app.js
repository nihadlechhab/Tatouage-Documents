const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // ← IMPORTANT
const documentController = require('./controllers/documentController');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration de Multer pour l'upload de fichiers
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        // Créer le dossier s'il n'existe pas
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Générer un nom de fichier unique
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    },
    fileFilter: function (req, file, cb) {
        // Accepter tous les types de fichiers
        cb(null, true);
    }
});

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

// Route pour l'upload de documents
app.post('/api/documents/upload', upload.single('document'), documentController.upload);

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

// Démarrage du serveur
app.listen(PORT, async () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`API disponible sur: http://localhost:${PORT}/api`);
    console.log(`Frontend disponible sur: http://localhost:${PORT}`);
    
    // 🔄 RESTAURATION AUTOMATIQUE AU DÉMARRAGE
    try {
        await documentController.restoreBackupOnStartup();
    } catch (error) {
        console.log('ℹ️  Restauration non nécessaire ou erreur mineure:', error.message);
    }
});