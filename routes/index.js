const express = require('express');
const router = express.Router();

// Import des routes
const authRoutes = require('./auth');
const documentRoutes = require('./documents');

// Routes principales
router.use('/auth', authRoutes);
router.use('/documents', documentRoutes);

// Route de santé de l'API
router.get('/health', (req, res) => {
    res.json({ 
        message: 'API Document Hashing fonctionne correctement',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

module.exports = router;