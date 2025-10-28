const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Variables globales pour la connexion
let gateway;
let contract;

// Fonction pour initialiser la connexion
const initializeGateway = async () => {
    if (gateway) return;

    try {
        // Chemin CORRECT vers le fichier de connexion
        const ccpPath = path.resolve(__dirname, '../backend/connection', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Chemin CORRECT vers le wallet (celui créé par votre script)
        const walletPath = path.join(__dirname, '../backend/wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        
        // Utiliser 'appUser' comme identité
        const identity = await wallet.get('appUser');
        if (!identity) {
            throw new Error("Identité appUser non trouvée dans le wallet.");
        }

        gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUser',  // ← IMPORTANT: utiliser 'appUser'
            discovery: { enabled: true, asLocalhost: true }
        });

        const network = await gateway.getNetwork('mychannel');
        contract = network.getContract('doccc');
        
        console.log('✅ Connexion Hyperledger Fabric établie');
    } catch (error) {
        console.error('❌ Erreur initialisation Fabric:', error);
        throw error;
    }
};

// Fonction pour consulter un document
const consulterDocument = async (hash) => {
    try {
        await initializeGateway();
        const result = await contract.evaluateTransaction('ConsulterDocument', hash);
        return result.toString();
    } catch (error) {
        console.error('Erreur consultation document:', error);
        if (error.message.includes("aucun document trouve avec le hash")) {
            throw error;
        }
        throw new Error(`Erreur blockchain: ${error.message}`);
    }
};

// Fonction pour enregistrer un document
const enregistrerDocument = async (hash, owner, timestamp) => {
    try {
        await initializeGateway();
        const result = await contract.submitTransaction('EnregistrerDocument', hash, owner, timestamp);
        return result.toString();
    } catch (error) {
        console.error('Erreur enregistrement document:', error);
        throw new Error(`Erreur blockchain: ${error.message}`);
    }
};

module.exports = {
    // POST /documents => enregistrer un document
    post: async (req, res) => {
        const { hash } = req.body;

        if (!req.session.user) {
            return res.status(401).json({ error: 'Utilisateur non authentifié.' });
        }

        const owner = req.session.user.username;
        const email = req.session.user.email;
        const now = new Date();

        const timestamp = now.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        try {
            // Vérifier si le document existe déjà
            let exists = false;
            try {
                const doc = await consulterDocument(hash);
                if (doc) exists = true;
            } catch (e) {
                // Si l'erreur est "document non trouvé", on continue
                if (!e.message.includes("aucun document trouve avec le hash")) {
                    throw e;
                }
            }

            if (exists) {
                return res.status(400).json({ error: 'Ce document est déjà enregistré.' });
            }

            // Enregistrer le document
            await enregistrerDocument(hash, owner, timestamp);

            res.status(200).json({ 
                message: 'Document enregistré avec succès dans la blockchain.',
                hash: hash,
                timestamp: timestamp,
                owner: owner
            });

        } catch (error) {
            console.error('Erreur enregistrement:', error);
            
            if (error.message.includes("déjà enregistré")) {
                return res.status(400).json({ error: error.message });
            }
            
            res.status(500).json({ 
                error: `Erreur lors de l'enregistrement: ${error.message}` 
            });
        }
    },

    // GET /documents?hash=... => consulter un document
    get: async (req, res) => {
        const { hash } = req.query;
        
        if (!hash) {
            return res.status(400).json({ error: 'Paramètre hash requis.' });
        }

        try {
            const result = await consulterDocument(hash);
            const documentData = JSON.parse(result);
            res.status(200).json(documentData);
        } catch (error) {
            if (error.message.includes("aucun document trouve avec le hash")) {
                return res.status(404).json({ 
                    error: 'Document non trouvé avec ce hash.' 
                });
            }
            res.status(500).json({ 
                error: `Erreur lors de la consultation: ${error.message}` 
            });
        }
    },

    getSess: async (req, res) => {
        if (!req.session.user) {
            res.json({ connected: false });
        } else {
            res.json({ 
                connected: true,
                user: req.session.user 
            });
        }
    }
};