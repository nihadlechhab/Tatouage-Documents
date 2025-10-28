const express = require('express');
const authController = require('../controllers/authController');
const router = express.Router();

// @route   POST /api/auth/validate-info
// @desc    Valider les informations utilisateur
// @access  Public
router.post('/validate-info', authController.validateInfo);

// @route   POST /api/auth/send-otp
// @desc    Envoyer OTP par email
// @access  Public
router.post('/send-otp', authController.sendOTP);

// @route   POST /api/auth/validate-otp
// @desc    Valider l'OTP
// @access  Public
router.post('/validate-otp', authController.validateOTP);

// @route   POST /api/auth/register
// @desc    Enregistrer un nouvel utilisateur
// @access  Public
router.post('/register', authController.post);

// @route   POST /api/auth/login
// @desc    Connexion utilisateur
// @access  Public
router.post('/login', authController.login);

// @route   POST /api/auth/logout
// @desc    Déconnexion utilisateur
// @access  Private
router.post('/logout', authController.logout);

module.exports = router;