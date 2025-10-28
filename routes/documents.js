const express = require('express');
const documentController = require('../controllers/documentController');
const router = express.Router();

// Middleware pour vérifier l'authentification
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ 
            error: 'Non authentifié',
            connected: false 
        });
    }
    next();
};

// @route   POST /api/documents
// @desc    Enregistrer un document dans la blockchain
// @access  Private
router.post('/', requireAuth, documentController.post);

// @route   GET /api/documents
// @desc    Consulter un document par son hash
// @access  Public
router.get('/', documentController.get);

// @route   GET /api/documents/session
// @desc    Vérifier l'état de la session
// @access  Public
router.get('/session', documentController.getSess);

module.exports = router;