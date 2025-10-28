const db = require('../backend/configDB');
const crypto = require('crypto');
const nodemailer = require("nodemailer");

// Fonction pour générer un OTP à 4 chiffres
function generateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Fonction pour hasher un mot de passe
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};
// Fonction pour valider l'email
const isValidEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};


// Fonction principale d'enregistrement
const register = async (email, password, username) => {
    const hashedPassword = hashPassword(password);

    await db.promise().query(
        'INSERT INTO users (email, username, password) VALUES (?, ?, ?)',
        [email, username, hashedPassword]
    );

    return { message: 'Utilisateur enregistré avec succès.' };
};

// Fonction de connexion
const login = async (email, password) => {
    const hashedPassword = hashPassword(password);

    const [results] = await db.promise().query(
        'SELECT * FROM users WHERE email = ?',
        [email]
    );

    if (results.length === 0) {
        throw new Error('Aucun utilisateur trouvé avec cet email.');
    }

    const user = results[0];

    if (user.password !== hashedPassword) {
        throw new Error('Mot de passe incorrect.');
    }

    return { message: 'Connexion réussie.', user: { email: user.email, username: user.username } };
};


module.exports = {
    post: async (req, res) => {
        const { email, password, username } = req.body;
        
        // ⚠️ OTP COMMENTÉ POUR TEST - DÉCOMMENTEZ POUR RÉACTIVER L'OTP ⚠️
        // if (!req.session.otpValidated || req.session.otpEmail !== email) {
        //     return res.status(403).json({ error: "Email non vérifié par OTP." });
        // }

        try {
            const result = await register(email, password, username);
            res.status(201).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    login: async (req, res) => {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis.' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Adresse e-mail invalide.' });
        }

        try {
            const result = await login(email, password);
            req.session.user = result.user;
            res.status(200).json(result);
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    },
    logout: (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur lors de la déconnexion.' });
            }
            res.clearCookie('connect.sid');
            res.status(200).json({ message: 'Déconnexion réussie.' });
        })
    },
    sendOTP: async (req, res) => {
        // ⚠️ OTP COMMENTÉ POUR TEST - DÉCOMMENTEZ POUR RÉACTIVER L'ENVOI D'EMAILS ⚠️
        /*
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'noreply.documenthashing@gmail.com', // l'adresse Gmail
                pass: 'pqmw ndam ogmu xyly' // Le mot de passe généré dans Google
            }
        });
        */
        const { email } = req.body;

        if (!email) return res.status(400).json({ error: "Email requis." });

        const otp = generateOTP();
        req.session.otp = otp;
        req.session.otpEmail = email;
        req.session.otpExpire = Date.now() + 5 * 60 * 1000; // 5 minutes

        // ⚠️ OTP COMMENTÉ POUR TEST - DÉCOMMENTEZ POUR RÉACTIVER L'ENVOI D'EMAILS ⚠️
        /*
        const mailOptions = {
            from: '<noreply@docLedger.com>',
            to: email,
            subject: "Code de vérification d'adresse e-mail",
            html: `<p>Votre code de vérification est : <strong>${otp}</strong><br>Ce code expirera en <strong>5 minutes</strong>.</p>`
        };

        try {
            await transporter.sendMail(mailOptions);
            res.status(200).json({ message: "Code envoyé." });
        } catch (err) {
            res.status(500).json({ error: "Erreur lors de l'envoi de l'email." });
        }
        */
        
        // ✅ POUR TEST - RETOURNE DIRECTEMENT L'OTP DANS LA RÉPONSE
        console.log(`📧 [TEST] OTP généré pour ${email}: ${otp}`);
        res.status(200).json({ 
            message: "Code OTP généré (mode test)", 
            otp: otp, // ⚠️ À retirer en production
            debug: "L'envoi d'email est désactivé en mode test" 
        });
    },
    validateOTP: (req, res) => {
        const { otp } = req.body;
        if (!otp) return res.status(400).json({ error: "OTP requis." });

        const { otp: sessionOtp, otpExpire } = req.session;
        if (!sessionOtp || Date.now() > otpExpire) {
            return res.status(400).json({ error: "OTP expiré ou invalide." });
        }

        if (otp !== sessionOtp) {
            return res.status(400).json({ error: "Code incorrect." });
        }

        req.session.otpValidated = true;
        res.status(200).json({ message: "OTP validé." });
    },
    validateInfo: async (req, res) => {
        const { email, password, username } = req.body;
        if (!email || !password || !username) {
            return res.status(400).json({ error: 'Tous les champs sont requis.' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Adresse e-mail invalide.' });
        }
        // Vérifier unicité
        const [results] = await db.promise().query(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [email, username]
        );

        if (results.length > 0) {
            return res.status(400).json({ error: 'Email ou nom d’utilisateur déjà utilisé.' });
        }
        res.status(200).json('informations validees');
    }

}